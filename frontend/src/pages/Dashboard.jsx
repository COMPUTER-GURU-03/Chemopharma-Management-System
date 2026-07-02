import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatMoney, formatDate, expiryStatus } from "../lib/format.js";
import Pill from "../components/Pill.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/reports/summary"),
      api.get("/products/alerts/expiry?days=30"),
      api.get("/products/alerts/low-stock"),
      api.get("/sales?limit=6"),
    ]).then(([s, exp, low, sales]) => {
      if (cancelled) return;
      setSummary(s);
      setExpiryAlerts(exp.alerts.slice(0, 5));
      setLowStock(low.alerts.slice(0, 5));
      setRecentSales(sales.sales);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell title={`Welcome back, ${user?.full_name?.split(" ")[0]}`} subtitle="Here's what's happening at the store today">
      {loading || !summary ? (
        <div className="empty-state">Loading dashboard…</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Today's Sales</div>
              <div className="stat-value">{formatMoney(summary.today_sales_total)}</div>
              <div className="stat-meta">{summary.today_sales_count} transaction{summary.today_sales_count === 1 ? "" : "s"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Products</div>
              <div className="stat-value">{summary.total_products}</div>
              <div className="stat-meta">Medicines &amp; cosmetics</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Low Stock</div>
              <div className={"stat-value" + (summary.low_stock_count > 0 ? " warn" : "")}>{summary.low_stock_count}</div>
              <div className="stat-meta">At or below reorder level</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expiring Soon</div>
              <div className={"stat-value" + (summary.expiring_soon_count > 0 ? " danger" : "")}>{summary.expiring_soon_count}</div>
              <div className="stat-meta">Within 60 days</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Restocks</div>
              <div className={"stat-value" + (summary.pending_restocks > 0 ? " warn" : "")}>{summary.pending_restocks}</div>
              <div className="stat-meta">Awaiting review</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
            <div className="card">
              <div className="card-header">
                <h2>Recent Sales</h2>
                <Link to="/sales" className="btn btn-ghost btn-sm">View all</Link>
              </div>
              {recentSales.length === 0 ? (
                <div className="empty-state">No sales recorded yet.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Reference</th><th>Cashier</th><th>Date</th><th className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.sale_ref}</td>
                        <td>{s.cashier_name}</td>
                        <td>{formatDate(s.created_at)}</td>
                        <td className="num mono">{formatMoney(s.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="card">
                <div className="card-header">
                  <h2>Expiring Soon</h2>
                  <Link to="/alerts" className="btn btn-ghost btn-sm">View all</Link>
                </div>
                {expiryAlerts.length === 0 ? (
                  <div className="empty-state">Nothing expiring within 30 days.</div>
                ) : (
                  <div style={{ padding: "4px 0" }}>
                    {expiryAlerts.map((a) => {
                      const status = expiryStatus(a.days_remaining);
                      return (
                        <div key={a.batch_id} className="cart-line" style={{ padding: "10px 20px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{a.product_name}</div>
                            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Batch {a.batch_number} · {a.quantity} units · {formatDate(a.expiry_date)}</div>
                          </div>
                          <Pill tone={status.tone}>{status.label}</Pill>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>Low Stock</h2>
                  <Link to="/alerts" className="btn btn-ghost btn-sm">View all</Link>
                </div>
                {lowStock.length === 0 ? (
                  <div className="empty-state">All products are above reorder level.</div>
                ) : (
                  <div style={{ padding: "4px 0" }}>
                    {lowStock.map((p) => (
                      <div key={p.id} className="cart-line" style={{ padding: "10px 20px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Reorder level: {p.reorder_level}</div>
                        </div>
                        <Pill tone="amber">{p.total_stock} left</Pill>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
