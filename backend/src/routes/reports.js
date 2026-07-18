import { Router } from "express";
import { db } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

// Dashboard summary — available to both roles, scoped sensibly on the frontend
router.get("/summary", (req, res) => {
  const todaySales = db.get(
    `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
     FROM sales WHERE date(created_at) = date('now')`
  );
  const totalProducts = db.get("SELECT COUNT(*) as count FROM products WHERE is_active = 1");
  const lowStockCount = db.get(
    `SELECT COUNT(*) as count FROM (
        SELECT p.id, COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.quantity ELSE 0 END),0) as stock, p.reorder_level
        FROM products p LEFT JOIN stock_batches b ON b.product_id = p.id
        WHERE p.is_active = 1 GROUP BY p.id HAVING stock <= p.reorder_level
     )`
  );
  const expiringCount = db.get(
    `SELECT COUNT(*) as count FROM stock_batches
     WHERE status = 'active' AND quantity > 0 AND expiry_date IS NOT NULL
       AND julianday(expiry_date) - julianday('now') <= 60`
  );
  const pendingRestocks = db.get(
    "SELECT COUNT(*) as count FROM restock_requests WHERE status = 'pending'"
  );

  res.json({
    today_sales_total: todaySales.total,
    today_sales_count: todaySales.count,
    total_products: totalProducts.count,
    low_stock_count: lowStockCount.count,
    expiring_soon_count: expiringCount.count,
    pending_restocks: pendingRestocks.count,
  });
});

// Sales performance over a date range, grouped by period (daily, weekly, monthly, yearly)
router.get("/sales-performance", requireRole("manager"), (req, res) => {
  const { from, to, period = "daily" } = req.query;
  
  // Determine grouping and label based on period
  let groupBy, label;
  switch(period) {
    case "weekly":
      groupBy = "strftime('%Y-W%W', created_at)";
      label = "week";
      break;
    case "monthly":
      groupBy = "strftime('%Y-%m', created_at)";
      label = "month";
      break;
    case "yearly":
      groupBy = "strftime('%Y', created_at)";
      label = "year";
      break;
    case "daily":
    default:
      groupBy = "date(created_at)";
      label = "day";
  }
  
  let sql = `
    SELECT ${groupBy} as period_label, COUNT(*) as transactions, SUM(total_amount) as revenue
    FROM sales WHERE 1=1
  `;
  const params = [];
  if (from) {
    sql += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND created_at <= ?";
    params.push(to);
  }
  sql += ` GROUP BY ${groupBy} ORDER BY period_label ASC`;
  
  const data = db.all(sql, params);
  
  // Format the results to include both period_label and a readable label
  const formatted = data.map(row => ({
    period: row.period_label,
    transactions: row.transactions,
    revenue: row.revenue
  }));

  const topProducts = db.all(
    `SELECT p.name, SUM(si.quantity) as units_sold, SUM(si.line_total) as revenue
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     ${from || to ? "WHERE 1=1" : ""}
     ${from ? "AND s.created_at >= ?" : ""}
     ${to ? "AND s.created_at <= ?" : ""}
     GROUP BY p.id ORDER BY revenue DESC LIMIT 10`,
    [...(from ? [from] : []), ...(to ? [to] : [])]
  );

  res.json({ period, data: formatted, top_products: topProducts });
});

// Stock status report
router.get("/stock-status", requireRole("manager"), (req, res) => {
  const rows = db.all(`
    SELECT p.id, p.name, p.category, p.reorder_level,
           COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.quantity ELSE 0 END),0) as total_stock,
           COALESCE(SUM(b.disposed_quantity),0) as total_disposed,
           CASE WHEN COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.quantity ELSE 0 END),0) <= p.reorder_level THEN 1 ELSE 0 END as is_low
    FROM products p LEFT JOIN stock_batches b ON b.product_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id ORDER BY p.name ASC
  `);
  res.json({ stock: rows });
});

// Disposal / wastage report — what's been written off, when, by whom, and why.
// This is the direct answer to "what happened to stock that expired before
// it sold": every write-off is here with quantity, cost impact, and reason.
router.get("/disposals", requireRole("manager"), (req, res) => {
  const rows = db.all(`
    SELECT b.id as batch_id, b.batch_number, b.disposed_quantity, b.disposed_reason, b.disposed_at,
           b.cost_price, (b.disposed_quantity * b.cost_price) as cost_impact,
           b.expiry_date, p.name as product_name, p.category, u.full_name as disposed_by_name
    FROM stock_batches b
    JOIN products p ON p.id = b.product_id
    LEFT JOIN users u ON u.id = b.disposed_by
    WHERE b.disposed_quantity > 0
    ORDER BY b.disposed_at DESC
  `);
  const totalUnitsDisposed = rows.reduce((sum, r) => sum + r.disposed_quantity, 0);
  const totalCostImpact = rows.reduce((sum, r) => sum + (r.cost_impact || 0), 0);
  res.json({ disposals: rows, total_units_disposed: totalUnitsDisposed, total_cost_impact: totalCostImpact });
});

// Restocking history
router.get("/restock-history", requireRole("manager"), (req, res) => {
  const rows = db.all(`
    SELECT r.*, p.name as product_name, u1.full_name as requested_by_name, u2.full_name as reviewed_by_name
    FROM restock_requests r
    JOIN products p ON p.id = r.product_id
    JOIN users u1 ON u1.id = r.requested_by
    LEFT JOIN users u2 ON u2.id = r.reviewed_by
    ORDER BY r.created_at DESC
  `);
  res.json({ history: rows });
});

// System activity log
router.get("/activity", requireRole("manager"), (req, res) => {
  const limit = Number(req.query.limit) || 100;
  const rows = db.all(
    `SELECT a.*, u.full_name as user_name FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT ?`,
    [limit]
  );
  res.json({ activity: rows });
});

export default router;
