import { Router } from "express";
import { db, logActivity } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

// List products with computed stock totals and nearest expiry.
// total_stock only counts ACTIVE batches (disposed stock is excluded).
// has_expired_active_stock flags products that still have active batches
// past their expiry date — these are sellable (nothing blocks the sale
// automatically) but should be visually flagged so staff notice and a
// manager can decide to dispose of them.
router.get("/", (req, res) => {
  const { category, search } = req.query;
  let sql = `
    SELECT p.*,
      COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.quantity ELSE 0 END), 0) AS total_stock,
      MIN(CASE WHEN b.status = 'active' AND b.quantity > 0 THEN b.expiry_date END) AS nearest_expiry,
      SUM(CASE WHEN b.status = 'active' AND b.quantity > 0 AND b.expiry_date IS NOT NULL
                    AND julianday(b.expiry_date) < julianday('now') THEN 1 ELSE 0 END) AS expired_batch_count
    FROM products p
    LEFT JOIN stock_batches b ON b.product_id = p.id
    WHERE p.is_active = 1
  `;
  const params = [];
  if (category) {
    sql += " AND p.category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND (p.name LIKE ? OR p.sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += " GROUP BY p.id ORDER BY p.name ASC";
  const products = db.all(sql, params);
  res.json({ products });
});

router.get("/:id", (req, res) => {
  const product = db.get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!product) return res.status(404).json({ error: "Product not found." });
  const batches = db.all(
    `SELECT b.*,
       CASE WHEN b.expiry_date IS NOT NULL AND julianday(b.expiry_date) < julianday('now')
            THEN 1 ELSE 0 END AS is_expired
     FROM stock_batches b
     WHERE b.product_id = ?
     ORDER BY (b.status = 'disposed'), (b.expiry_date IS NULL), b.expiry_date ASC`,
    [req.params.id]
  );
  res.json({ product, batches });
});

// Create product — manager only
router.post("/", requireRole("manager"), (req, res) => {
  const { name, category, sku, unit, unit_price, reorder_level, requires_prescription } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: "Name and category are required." });
  }
  if (!["medicine", "cosmetic"].includes(category)) {
    return res.status(400).json({ error: "Category must be medicine or cosmetic." });
  }
  const result = db.run(
    `INSERT INTO products (name, category, sku, unit, unit_price, reorder_level, requires_prescription)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      category,
      sku || null,
      unit || "unit",
      Number(unit_price) || 0,
      Number(reorder_level) || 10,
      requires_prescription ? 1 : 0,
    ]
  );
  logActivity(req.user.id, "product_created", { product_id: Number(result.lastInsertRowid), name });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Update product — manager only
router.put("/:id", requireRole("manager"), (req, res) => {
  const { name, category, sku, unit, unit_price, reorder_level, requires_prescription, is_active } = req.body;
  const existing = db.get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  db.run(
    `UPDATE products SET name=?, category=?, sku=?, unit=?, unit_price=?, reorder_level=?, requires_prescription=?, is_active=?
     WHERE id = ?`,
    [
      name ?? existing.name,
      category ?? existing.category,
      sku ?? existing.sku,
      unit ?? existing.unit,
      unit_price != null ? Number(unit_price) : existing.unit_price,
      reorder_level != null ? Number(reorder_level) : existing.reorder_level,
      requires_prescription != null ? (requires_prescription ? 1 : 0) : existing.requires_prescription,
      is_active != null ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id,
    ]
  );
  logActivity(req.user.id, "product_updated", { product_id: Number(req.params.id) });
  res.json({ ok: true });
});

// Receive new stock (new batch) — manager only (restocking is controlled)
router.post("/:id/batches", requireRole("manager"), (req, res) => {
  const { batch_number, quantity, expiry_date, cost_price, restock_request_id } = req.body;
  const product = db.get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (!batch_number || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ error: "Batch number and a positive quantity are required." });
  }
  const result = db.run(
    `INSERT INTO stock_batches (product_id, batch_number, quantity, expiry_date, cost_price, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.params.id, batch_number, Number(quantity), expiry_date || null, Number(cost_price) || 0, req.user.id]
  );
  logActivity(req.user.id, "stock_received", {
    product_id: Number(req.params.id),
    batch_id: Number(result.lastInsertRowid),
    quantity: Number(quantity),
    restock_request_id: restock_request_id || null,
  });

  if (restock_request_id) {
    db.run("UPDATE restock_requests SET status = 'fulfilled' WHERE id = ?", [restock_request_id]);
  }

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Dispose of (write off) stock from a batch — manager only.
// This is the deliberate, auditable step that removes expired/damaged
// stock from what's sellable. We do NOT auto-hide expired batches from
// sales, because FEFO at checkout is a default ordering, not an enforced
// guarantee — a later batch can get sold first, so relying on expiry_date
// alone to silently exclude stock would understate what's really on the
// shelf. Disposal can be partial (e.g. 40 of 50 units were damaged) or
// full; a partial disposal leaves the remaining quantity active and still
// sellable.
router.post("/:id/batches/:batchId/dispose", requireRole("manager"), (req, res) => {
  const { quantity, reason } = req.body;
  const batch = db.get(
    "SELECT * FROM stock_batches WHERE id = ? AND product_id = ?",
    [req.params.batchId, req.params.id]
  );
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  if (batch.status === "disposed") {
    return res.status(409).json({ error: "This batch has already been disposed of." });
  }
  const disposeQty = quantity != null ? Number(quantity) : batch.quantity;
  if (!disposeQty || disposeQty <= 0 || disposeQty > batch.quantity) {
    return res.status(400).json({ error: `Quantity to dispose must be between 1 and ${batch.quantity}.` });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: "A reason is required when disposing of stock." });
  }

  const remaining = batch.quantity - disposeQty;
  const nowFullyDisposed = remaining === 0;

  db.run(
    `UPDATE stock_batches
     SET quantity = ?,
         status = ?,
         disposed_quantity = disposed_quantity + ?,
         disposed_reason = ?,
         disposed_by = ?,
         disposed_at = datetime('now')
     WHERE id = ?`,
    [remaining, nowFullyDisposed ? "disposed" : "active", disposeQty, reason.trim(), req.user.id, batch.id]
  );

  logActivity(req.user.id, "stock_disposed", {
    product_id: Number(req.params.id),
    batch_id: batch.id,
    batch_number: batch.batch_number,
    quantity_disposed: disposeQty,
    reason: reason.trim(),
    fully_disposed: nowFullyDisposed,
  });

  res.json({ ok: true, fully_disposed: nowFullyDisposed, remaining_quantity: remaining });
});

// Expiry alerts: batches expiring within N days (default 60), or already expired.
// Only ACTIVE batches are included — once a batch is disposed it's no
// longer "at risk", it's already dealt with.
router.get("/alerts/expiry", (req, res) => {
  const days = Number(req.query.days) || 60;
  const rows = db.all(
    `SELECT b.id as batch_id, b.batch_number, b.quantity, b.expiry_date,
            p.id as product_id, p.name as product_name, p.category,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_remaining
     FROM stock_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.status = 'active' AND b.quantity > 0 AND b.expiry_date IS NOT NULL
       AND julianday(b.expiry_date) - julianday('now') <= ?
     ORDER BY b.expiry_date ASC`,
    [days]
  );
  res.json({ alerts: rows });
});

// Low stock alerts
router.get("/alerts/low-stock", (req, res) => {
  const rows = db.all(
    `SELECT p.id, p.name, p.category, p.reorder_level,
            COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.quantity ELSE 0 END), 0) AS total_stock
     FROM products p
     LEFT JOIN stock_batches b ON b.product_id = p.id
     WHERE p.is_active = 1
     GROUP BY p.id
     HAVING total_stock <= p.reorder_level
     ORDER BY total_stock ASC`
  );
  res.json({ alerts: rows });
});

export default router;
