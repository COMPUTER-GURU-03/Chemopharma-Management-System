import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Modal from "../components/Modal.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate, formatDateTime } from "../lib/format.js";
import { IconPlus, IconCheck, IconX } from "../components/Icons.jsx";

const STATUS_TONE = { pending: "amber", approved: "teal", rejected: "red", fulfilled: "green" };

export default function Restock() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [reviewing, setReviewing] = useState(null); // request being reviewed
  const [receiving, setReceiving] = useState(null); // request being received
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const data = await api.get(`/restock${params}`);
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <AppShell title="Restocking" subtitle="Request replenishment and review approvals">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="fulfilled">Fulfilled</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowRequest(true)}>
          <IconPlus width={15} height={15} /> New Request
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">No restock requests found.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty Requested</th>
                  <th>Requested By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  {isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.product_name}</td>
                    <td className="num">{r.requested_quantity}</td>
                    <td>{r.requested_by_name}</td>
                    <td>{formatDate(r.created_at)}</td>
                    <td><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill></td>
                    <td>{r.reviewed_by_name || "—"}</td>
                    <td className="num">
                      {r.status === "pending" && isManager ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setReviewing(r)}>Review</button>
                      ) : r.status === "approved" ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setReceiving(r)}>Receive</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {receiving && (
        <ReceiveModal
          request={receiving}
          onClose={() => setReceiving(null)}
          onReceived={() => { setReceiving(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function RequestModal({ onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
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
      await api.post("/restock", {
        product_id: Number(productId),
        requested_quantity: Number(quantity),
        reason: reason || null,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Request Restock" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Product</label>
          <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — currently {p.total_stock} in stock</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity requested</label>
          <input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="field">
          <label>Reason (optional)</label>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stock running low, high demand expected" />
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
      await api.patch(`/restock/${request.id}/review`, { decision, review_note: note || null });
      onReviewed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Review Restock Request" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{request.product_name}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
          {request.requested_quantity} units requested by {request.requested_by_name} on {formatDateTime(request.created_at)}
        </div>
        {request.reason && (
          <div style={{ fontSize: 13, marginTop: 8, padding: "8px 10px", background: "var(--bg-raised)", borderRadius: 6 }}>
            "{request.reason}"
          </div>
        )}
      </div>
      <div className="field">
        <label>Review note (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for this decision…" />
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

function ReceiveModal({ request, onClose, onReceived }) {
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post(`/restock/${request.id}/receive`, {
        batch_number: batchNumber,
        quantity: Number(quantity),
        expiry_date: expiryDate || null,
        cost_price: costPrice ? Number(costPrice) : 0,
      });
      onReceived();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Receive ${request.product_name}`} onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Batch number</label>
          <input required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Quantity received</label>
          <input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Expiry date</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Cost price (K)</label>
            <input type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Optional note</label>
          <textarea rows={2} value={request.reason} readOnly disabled style={{ opacity: 0.7 }} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Receiving…" : "Receive Stock"}</button>
        </div>
      </form>
    </Modal>
  );
}
