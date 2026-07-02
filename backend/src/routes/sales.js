import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, logActivity } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

router.get("/", (req, res) => {
  const { from, to, limit } = req.query;
  let sql = `
    SELECT s.*, u.full_name as cashier_name
    FROM sales s JOIN users u ON u.id = s.cashier_id
    WHERE 1=1
  `;
  const params = [];
  if (from) {
    sql += " AND s.created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND s.created_at <= ?";
    params.push(to);
  }
  sql += " ORDER BY s.created_at DESC LIMIT ?";
  params.push(Number(limit) || 100);
  const sales = db.all(sql, params);
  res.json({ sales });
});

router.get("/:id", (req, res) => {
  const sale = db.get(
    `SELECT s.*, u.full_name as cashier_name FROM sales s JOIN users u ON u.id = s.cashier_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!sale) return res.status(404).json({ error: "Sale not found." });
  const items = db.all(
    `SELECT si.*, p.name as product_name FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?`,
    [req.params.id]
  );
  res.json({ sale, items });
});

// Record a sale. Body: { customer_name, payment_method, items: [{ product_id, quantity }] }
// Deducts stock using FEFO (first-expiry-first-out) across batches.
router.post("/", requireRole("manager", "pharmacist"), (req, res) => {
  const { customer_name, payment_method, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one sale item is required." });
  }

  // Validate stock availability up front
  for (const item of items) {
    const product = db.get("SELECT * FROM products WHERE id = ?", [item.product_id]);
    if (!product) {
      return res.status(404).json({ error: `Product ${item.product_id} not found.` });
    }
    const totalAvailable = db.get(
      "SELECT COALESCE(SUM(quantity),0) as total FROM stock_batches WHERE product_id = ? AND status = 'active'",
      [item.product_id]
    ).total;
    if (Number(item.quantity) <= 0) {
      return res.status(400).json({ error: `Quantity for ${product.name} must be positive.` });
    }
    if (totalAvailable < Number(item.quantity)) {
      return res.status(409).json({
        error: `Insufficient stock for ${product.name}. Available: ${totalAvailable}, requested: ${item.quantity}.`,
      });
    }
  }

  const saleRef = "SALE-" + uuidv4().slice(0, 8).toUpperCase();
  let totalAmount = 0;
  const lineRecords = [];

  for (const item of items) {
    const product = db.get("SELECT * FROM products WHERE id = ?", [item.product_id]);
    let remaining = Number(item.quantity);
    const batches = db.all(
      `SELECT * FROM stock_batches WHERE product_id = ? AND quantity > 0 AND status = 'active'
       ORDER BY (expiry_date IS NULL), expiry_date ASC, received_date ASC`,
      [item.product_id]
    );
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      db.run("UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?", [take, batch.id]);
      const lineTotal = take * product.unit_price;
      totalAmount += lineTotal;
      lineRecords.push({
        product_id: product.id,
        batch_id: batch.id,
        quantity: take,
        unit_price: product.unit_price,
        line_total: lineTotal,
      });
      remaining -= take;
    }
  }

  const saleResult = db.run(
    `INSERT INTO sales (sale_ref, cashier_id, total_amount, payment_method, customer_name)
     VALUES (?, ?, ?, ?, ?)`,
    [saleRef, req.user.id, totalAmount, payment_method || "cash", customer_name || null]
  );
  const saleId = Number(saleResult.lastInsertRowid);

  for (const line of lineRecords) {
    db.run(
      `INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [saleId, line.product_id, line.batch_id, line.quantity, line.unit_price, line.line_total]
    );
  }

  logActivity(req.user.id, "sale_recorded", { sale_id: saleId, sale_ref: saleRef, total_amount: totalAmount });

  res.status(201).json({ id: saleId, sale_ref: saleRef, total_amount: totalAmount });
});

export default router;
