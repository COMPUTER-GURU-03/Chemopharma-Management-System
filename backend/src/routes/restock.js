import { Router } from "express";
import { db, logActivity } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

router.get("/", (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT r.*, p.name as product_name, p.category,
           u1.full_name as requested_by_name,
           u2.full_name as reviewed_by_name
    FROM restock_requests r
    JOIN products p ON p.id = r.product_id
    JOIN users u1 ON u1.id = r.requested_by
    LEFT JOIN users u2 ON u2.id = r.reviewed_by
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += " AND r.status = ?";
    params.push(status);
  }
  sql += " ORDER BY r.created_at DESC";
  const requests = db.all(sql, params);
  res.json({ requests });
});

// Pharmacist (or manager) raises a restock request
router.post("/", requireRole("manager", "pharmacist"), (req, res) => {
  const { product_id, requested_quantity, reason } = req.body;
  if (!product_id || !requested_quantity || Number(requested_quantity) <= 0) {
    return res.status(400).json({ error: "Product and a positive requested quantity are required." });
  }
  const product = db.get("SELECT id FROM products WHERE id = ?", [product_id]);
  if (!product) return res.status(404).json({ error: "Product not found." });

  const result = db.run(
    `INSERT INTO restock_requests (product_id, requested_by, requested_quantity, reason)
     VALUES (?, ?, ?, ?)`,
    [product_id, req.user.id, Number(requested_quantity), reason || null]
  );
  logActivity(req.user.id, "restock_requested", {
    request_id: Number(result.lastInsertRowid),
    product_id,
    requested_quantity,
  });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Manager approves or rejects
router.patch("/:id/review", requireRole("manager"), (req, res) => {
  const { decision, review_note } = req.body; // decision: 'approved' | 'rejected'
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be approved or rejected." });
  }
  const request = db.get("SELECT * FROM restock_requests WHERE id = ?", [req.params.id]);
  if (!request) return res.status(404).json({ error: "Restock request not found." });
  if (request.status !== "pending") {
    return res.status(409).json({ error: "This request has already been reviewed." });
  }
  db.run(
    `UPDATE restock_requests SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
    [decision, req.user.id, review_note || null, req.params.id]
  );
  logActivity(req.user.id, "restock_reviewed", { request_id: Number(req.params.id), decision });
  res.json({ ok: true });
});

// Manager receives approved stock and creates a new batch
router.post("/:id/receive", requireRole("manager"), (req, res) => {
  const { batch_number, quantity, expiry_date, cost_price } = req.body;
  const request = db.get("SELECT * FROM restock_requests WHERE id = ?", [req.params.id]);
  if (!request) return res.status(404).json({ error: "Restock request not found." });
  if (request.status !== "approved") {
    return res.status(409).json({ error: "Only approved requests can be received." });
  }
  if (!batch_number || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ error: "Batch number and a positive quantity are required." });
  }
  const product = db.get("SELECT * FROM products WHERE id = ?", [request.product_id]);
  if (!product) return res.status(404).json({ error: "Product not found." });

  const result = db.run(
    `INSERT INTO stock_batches (product_id, batch_number, quantity, expiry_date, cost_price, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [request.product_id, batch_number, Number(quantity), expiry_date || null, Number(cost_price) || 0, req.user.id]
  );
  db.run("UPDATE restock_requests SET status = 'fulfilled' WHERE id = ?", [req.params.id]);

  logActivity(req.user.id, "restock_received", {
    request_id: Number(req.params.id),
    product_id: request.product_id,
    batch_id: Number(result.lastInsertRowid),
    quantity: Number(quantity),
  });

  res.status(201).json({ ok: true, batch_id: Number(result.lastInsertRowid) });
});

export default router;
