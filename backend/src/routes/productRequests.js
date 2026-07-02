import { Router } from "express";
import { db, logActivity } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

// Product creation requests: pharmacists can propose new products with initial
// stock details, and managers can approve or reject them.
router.get("/", (req, res) => {
  const { status } = req.query;
  const isManager = req.user.role === "manager";
  let sql = `
    SELECT pr.*, u1.full_name as requested_by_name, u2.full_name as reviewed_by_name
    FROM product_requests pr
    JOIN users u1 ON u1.id = pr.requested_by
    LEFT JOIN users u2 ON u2.id = pr.reviewed_by
    WHERE 1=1
  `;
  const params = [];
  if (!isManager) {
    sql += " AND pr.requested_by = ?";
    params.push(req.user.id);
  }
  if (status) {
    sql += " AND pr.status = ?";
    params.push(status);
  }
  sql += " ORDER BY pr.created_at DESC";
  const requests = db.all(sql, params);
  res.json({ requests });
});

router.post("/", requireRole("manager", "pharmacist"), (req, res) => {
  const {
    name,
    category,
    sku,
    unit,
    unit_price,
    reorder_level,
    requires_prescription,
    batch_number,
    quantity,
    expiry_date,
    cost_price,
    reason,
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: "Product name and category are required." });
  }
  if (!["medicine", "cosmetic"].includes(category)) {
    return res.status(400).json({ error: "Category must be medicine or cosmetic." });
  }
  if (quantity != null && Number(quantity) <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive number." });
  }
  if (quantity && !batch_number) {
    return res.status(400).json({ error: "Batch number is required when requesting initial stock." });
  }

  const result = db.run(
    `INSERT INTO product_requests (
       name, category, sku, unit, unit_price, reorder_level, requires_prescription,
       batch_number, quantity, expiry_date, cost_price, requested_by, review_note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      category,
      sku || null,
      unit || "unit",
      Number(unit_price) || 0,
      Number(reorder_level) || 10,
      requires_prescription ? 1 : 0,
      batch_number || null,
      quantity != null ? Number(quantity) : null,
      expiry_date || null,
      Number(cost_price) || 0,
      req.user.id,
      reason || null,
    ]
  );

  logActivity(req.user.id, "product_request_created", {
    request_id: Number(result.lastInsertRowid),
    name,
    category,
  });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

router.patch("/:id/review", requireRole("manager"), (req, res) => {
  const { decision, review_note } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be approved or rejected." });
  }
  const request = db.get("SELECT * FROM product_requests WHERE id = ?", [req.params.id]);
  if (!request) return res.status(404).json({ error: "Product request not found." });
  if (request.status !== "pending") {
    return res.status(409).json({ error: "This request has already been reviewed." });
  }

  if (decision === "approved") {
    if (request.sku) {
      const existing = db.get("SELECT id FROM products WHERE sku = ?", [request.sku]);
      if (existing) {
        return res.status(409).json({ error: "A product with this SKU already exists." });
      }
    }

    const productResult = db.run(
      `INSERT INTO products (name, category, sku, unit, unit_price, reorder_level, requires_prescription)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        request.name,
        request.category,
        request.sku,
        request.unit,
        request.unit_price,
        request.reorder_level,
        request.requires_prescription,
      ]
    );
    const productId = Number(productResult.lastInsertRowid);

    if (request.quantity && request.quantity > 0) {
      db.run(
        `INSERT INTO stock_batches (product_id, batch_number, quantity, expiry_date, cost_price, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, request.batch_number, request.quantity, request.expiry_date, request.cost_price, req.user.id]
      );
    }

    db.run(
      `UPDATE product_requests
       SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = datetime('now')
       WHERE id = ?`,
      [decision, req.user.id, review_note || null, req.params.id]
    );

    logActivity(req.user.id, "product_request_approved", {
      request_id: Number(req.params.id),
      product_id: productId,
    });
    return res.json({ ok: true, product_id: productId });
  }

  db.run(
    `UPDATE product_requests
     SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
    [decision, req.user.id, review_note || null, req.params.id]
  );

  logActivity(req.user.id, "product_request_rejected", { request_id: Number(req.params.id) });
  res.json({ ok: true });
});

export default router;
