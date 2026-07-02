import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Modal from "../components/Modal.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate, formatDateTime } from "../lib/format.js";
import { IconPlus, IconCheck, IconX } from "../components/Icons.jsx";

const STATUS_TONE = { pending: "amber", approved: "teal", rejected: "red" };

export default function ProductRequests() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const data = await api.get(`/product-requests${params}`);
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <AppShell title="Product Requests" subtitle="Request new products and review manager approvals">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowRequest(true)}>
          <IconPlus width={15} height={15} /> New Product Request
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading product requests…</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">No product requests found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th className="num">Qty</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Date</th>
                {isManager && <th></th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td style={{ fontWeight: 600 }}>{request.name}</td>
                  <td style={{ textTransform: "capitalize" }}>{request.category}</td>
                  <td className="mono">{request.sku || "—"}</td>
                  <td className="num">{request.quantity || "—"}</td>
                  <td><Pill tone={STATUS_TONE[request.status]}>{request.status}</Pill></td>
                  <td>{request.requested_by_name}</td>
                  <td>{formatDate(request.created_at)}</td>
                  {isManager && (
                    <td className="num">
                      {request.status === "pending" ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setReviewing(request)}>
                          Review
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRequest && (
        <RequestModal onClose={() => setShowRequest(false)} onCreated={() => { setShowRequest(false); load(); }} />
      )}

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={() => { setReviewing(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function RequestModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    category: "medicine",
    sku: "",
    unit: "unit",
    unit_price: "",
    reorder_level: "10",
    requires_prescription: false,
    batch_number: "",
    quantity: "",
    expiry_date: "",
    cost_price: "",
    reason: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/products").then((d) => setProducts(d.products));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/product-requests", {
        ...form,
        unit_price: Number(form.unit_price) || 0,
        reorder_level: Number(form.reorder_level) || 10,
        requires_prescription: form.requires_prescription,
        quantity: form.quantity ? Number(form.quantity) : null,
        cost_price: form.cost_price ? Number(form.cost_price) : null,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Request New Product" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Product name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="medicine">Medicine</option>
              <option value="cosmetic">Cosmetic</option>
            </select>
          </div>
          <div className="field">
            <label>SKU (optional)</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Unit</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="field">
            <label>Unit price (K)</label>
            <input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Reorder level</label>
            <input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
          </div>
          <div className="field">
            <label>Requires prescription</label>
            <input
              type="checkbox"
              checked={form.requires_prescription}
              onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })}
            />
          </div>
        </div>
        <div className="field">
          <label>Initial stock batch number (optional)</label>
          <input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Initial quantity</label>
            <input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="field">
            <label>Cost price (K)</label>
            <input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Expiry date</label>
          <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Reason</label>
          <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why should this new product be added?" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Submitting…" : "Submit Request"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({ request, onClose, onReviewed }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function decide(decision) {
    setError("");
    setSaving(true);
    try {
      await api.patch(`/product-requests/${request.id}/review`, { decision, review_note: note || null });
      onReviewed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Review Product Request" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{request.name}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
          Requested by {request.requested_by_name} on {formatDateTime(request.created_at)}
        </div>
        {request.reason && (
          <div style={{ fontSize: 13, marginTop: 8, padding: "8px 10px", background: "var(--bg-raised)", borderRadius: 6 }}>
            "{request.reason}"
          </div>
        )}
      </div>
      <div className="field">
        <label>Manager note (optional)</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={() => decide("rejected")} disabled={saving}>
          <IconX width={14} height={14} /> Reject
        </button>
        <button className="btn btn-primary" onClick={() => decide("approved")} disabled={saving}>
          <IconCheck width={14} height={14} /> Approve
        </button>
      </div>
    </Modal>
  );
}
