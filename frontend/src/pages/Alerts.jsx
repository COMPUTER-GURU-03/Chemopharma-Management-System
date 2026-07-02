import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { formatDate, expiryStatus } from "../lib/format.js";

export default function Alerts() {
  const [tab, setTab] = useState("expiry");
  const [expiryDays, setExpiryDays] = useState(60);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/products/alerts/expiry?days=${expiryDays}`),
      api.get("/products/alerts/low-stock"),
    ]).then(([exp, low]) => {
      setExpiryAlerts(exp.alerts);
      setLowStock(low.alerts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [expiryDays]);

  return (
    <AppShell title="Alerts" subtitle="Stay ahead of expiring stock and reorder points">
      <div className="tabs">
        <button className={"tab" + (tab === "expiry" ? " active" : "")} onClick={() => setTab("expiry")}>
          Expiry Monitoring {expiryAlerts.length > 0 && `(${expiryAlerts.length})`}
        </button>
        <button className={"tab" + (tab === "low" ? " active" : "")} onClick={() => setTab("low")}>
          Low Stock {lowStock.length > 0 && `(${lowStock.length})`}
        </button>
      </div>

      {tab === "expiry" && (
        <>
          <div className="toolbar">
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Show batches expiring within</span>
            <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
          </div>
          <div className="card">
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : expiryAlerts.length === 0 ? (
              <div className="empty-state">No batches expiring within {expiryDays} days. Stock is in good shape.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Category</th><th>Batch</th><th className="num">Qty</th><th>Expiry Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {expiryAlerts.map((a) => {
                    const status = expiryStatus(a.days_remaining);
                    return (
                      <tr key={a.batch_id}>
                        <td style={{ fontWeight: 600 }}>{a.product_name}</td>
                        <td style={{ textTransform: "capitalize" }}>{a.category}</td>
                        <td className="mono">{a.batch_number}</td>
                        <td className="num">{a.quantity}</td>
                        <td>{formatDate(a.expiry_date)}</td>
                        <td><Pill tone={status.tone}>{status.label}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "low" && (
        <div className="card">
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : lowStock.length === 0 ? (
            <div className="empty-state">All products are above their reorder level.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th>Category</th><th className="num">Current Stock</th><th className="num">Reorder Level</th></tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                    <td className="num"><Pill tone="red">{p.total_stock}</Pill></td>
                    <td className="num">{p.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AppShell>
  );
}
