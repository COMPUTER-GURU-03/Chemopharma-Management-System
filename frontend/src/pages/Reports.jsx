import { useEffect, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import AppShell from "../components/AppShell.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { formatMoney, formatDate, formatDateTime } from "../lib/format.js";

const STATUS_TONE = { pending: "amber", approved: "teal", rejected: "red", fulfilled: "green" };

function escapeCsv(value) {
  if (value == null) return "";
  const safe = String(value).replace(/"/g, '""');
  return `"${safe}"`;
}

function downloadCsv(filename, columns, rows) {
  const header = columns.map((col) => escapeCsv(col.label)).join(",");
  const body = rows.map((row) => columns.map((col) => escapeCsv(typeof col.value === "function" ? col.value(row) : row[col.value])).join(",")).join("\n");
  const csv = [header, body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function ReportActions({ onPrint, onDownload }) {
  return (
    <div className="report-actions">
      <button className="btn btn-secondary" onClick={onPrint}>Print</button>
      <button className="btn btn-secondary" onClick={onDownload}>Download CSV</button>
      <small style={{ alignSelf: 'center', color: 'var(--text-secondary)', marginLeft: '10px', fontSize: '12px' }}>
        💡 Tip: Use Landscape orientation for better chart visibility
      </small>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState("sales");

  return (
    <AppShell title="Reports" subtitle="Sales performance, stock status, and system activity">
      <div className="tabs">
        <button className={"tab" + (tab === "sales" ? " active" : "")} onClick={() => setTab("sales")}>Sales Performance</button>
        <button className={"tab" + (tab === "stock" ? " active" : "")} onClick={() => setTab("stock")}>Stock Status</button>
        <button className={"tab" + (tab === "restock" ? " active" : "")} onClick={() => setTab("restock")}>Restocking History</button>
        <button className={"tab" + (tab === "activity" ? " active" : "")} onClick={() => setTab("activity")}>Activity Log</button>
      </div>
      {tab === "sales" && <SalesReport />}
      {tab === "stock" && <StockReport />}
      {tab === "restock" && <RestockReport />}
      {tab === "activity" && <ActivityReport />}
    </AppShell>
  );
}

function SalesReport() {
  const [data, setData] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    api.get("/reports/sales-performance").then(setData);
  }, []);

  if (!data) return <div className="empty-state">Loading…</div>;

  const chartData = data.daily.map((d) => ({ ...d, revenue: Number(d.revenue) }));

  return (
    <>
      <ReportActions
        onPrint={() => window.print()}
        onDownload={() => downloadCsv(
          "sales-performance.csv",
          [
            { label: "Day", value: "day" },
            { label: "Revenue", value: (row) => formatMoney(row.revenue) },
          ],
          chartData
        )}
      />
      <div className="card print-card-chart" style={{ marginBottom: 18 }}>
        <div className="card-header"><h2>Revenue by Day</h2></div>
        <div className="card-pad print-chart-container" ref={chartRef} style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {chartData.length === 0 ? (
            <div className="empty-state">No sales recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  angle={data.daily.length > 14 ? -45 : 0}
                  textAnchor={data.daily.length > 14 ? "end" : "middle"}
                  height={data.daily.length > 14 ? 80 : 40}
                />
                <YAxis tick={{ fontSize: 12 }} width={60} />
                <Tooltip formatter={(v) => formatMoney(v)} labelStyle={{ color: '#000' }} />
                <Line type="monotone" dataKey="revenue" stroke="#14807f" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card print-card-table">
        <div className="card-header"><h2>Top Products by Revenue</h2></div>
        {data.top_products.length === 0 ? (
          <div className="empty-state">No sales data yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table print-data-table">
              <thead><tr><th>Product</th><th className="num">Units Sold</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {data.top_products.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="num">{p.units_sold}</td>
                    <td className="num mono">{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Summary Footer */}
      <div className="print-summary">
        <p><strong>Report Generated:</strong> {new Date().toLocaleString()}</p>
        <p><strong>Date Range:</strong> {chartData.length > 0 ? `${chartData[0].day} to ${chartData[chartData.length - 1].day}` : 'N/A'}</p>
        <p><strong>Total Transactions:</strong> {chartData.reduce((sum, d) => sum + d.transactions, 0)}</p>
        <p><strong>Total Revenue:</strong> {formatMoney(chartData.reduce((sum, d) => sum + d.revenue, 0))}</p>
      </div>
    </>
  );
}

function StockReport() {
  const [stock, setStock] = useState(null);

  useEffect(() => {
    api.get("/reports/stock-status").then((d) => setStock(d.stock));
  }, []);

  if (!stock) return <div className="empty-state">Loading…</div>;

  return (
    <>
      <ReportActions
        onPrint={() => window.print()}
        onDownload={() => downloadCsv(
          "stock-status.csv",
          [
            { label: "Product", value: "name" },
            { label: "Category", value: "category" },
            { label: "Stock", value: "total_stock" },
            { label: "Reorder Level", value: "reorder_level" },
            { label: "Status", value: (row) => (row.is_low ? "Low" : "Healthy") },
          ],
          stock
        )}
      />
      <div className="card">
        {stock.length === 0 ? (
          <div className="empty-state">No products yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Stock</th>
                  <th className="num">Reorder Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                    <td className="num">{p.total_stock}</td>
                    <td className="num">{p.reorder_level}</td>
                    <td>{p.is_low ? <Pill tone="red">Low</Pill> : <Pill tone="green">Healthy</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function RestockReport() {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get("/reports/restock-history").then((d) => setHistory(d.history));
  }, []);

  if (!history) return <div className="empty-state">Loading…</div>;

  return (
    <>
      <ReportActions
        onPrint={() => window.print()}
        onDownload={() => downloadCsv(
          "restock-history.csv",
          [
            { label: "Product", value: "product_name" },
            { label: "Quantity", value: "requested_quantity" },
            { label: "Requested By", value: "requested_by_name" },
            { label: "Status", value: (row) => row.status },
            { label: "Reviewed By", value: "reviewed_by_name" },
            { label: "Date", value: (row) => formatDate(row.created_at) },
          ],
          history
        )}
      />
      <div className="card">
        {history.length === 0 ? (
          <div className="empty-state">No restock requests yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th>Requested By</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.product_name}</td>
                    <td className="num">{r.requested_quantity}</td>
                    <td>{r.requested_by_name}</td>
                    <td><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></td>
                    <td>{r.reviewed_by_name || "—"}</td>
                    <td>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityReport() {
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    api.get("/reports/activity?limit=150").then((d) => setActivity(d.activity));
  }, []);

  if (!activity) return <div className="empty-state">Loading…</div>;

  return (
    <>
      <ReportActions
        onPrint={() => window.print()}
        onDownload={() => downloadCsv(
          "activity-log.csv",
          [
            { label: "User", value: "user_name" },
            { label: "Action", value: (row) => row.action.replace(/_/g, " ") },
            { label: "Date", value: (row) => formatDateTime(row.created_at) },
          ],
          activity
        )}
      />
      <div className="card">
        {activity.length === 0 ? (
          <div className="empty-state">No activity logged yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td>{a.user_name || "System"}</td>
                    <td><Pill tone="gray">{a.action.replace(/_/g, " ")}</Pill></td>
                    <td>{formatDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
