import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Modal from "../components/Modal.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatMoney, formatDate, expiryStatus } from "../lib/format.js";
import { IconPlus, IconSearch, IconBox } from "../components/Icons.jsx";

export default function Inventory() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null); // product id for detail/batches view

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      const data = await api.get(`/products?${params.toString()}`);
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [category]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  return (
    <AppShell title="Inventory" subtitle="Medicines and cosmetic products, tracked by batch">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm"><IconSearch width={14} height={14} /></button>
        </form>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="medicine">Medicine</option>
          <option value="cosmetic">Cosmetic</option>
        </select>
        <div className="spacer" />
        {isManager && (
          <button className="btn btn-primary" onClick={() => setShowAddProduct(true)}>
            <IconPlus width={15} height={15} /> Add Product
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading inventory…</div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <IconBox width={28} height={28} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
            No products found. {isManager && "Add your first product to get started."}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th className="num">Unit Price</th>
                <th className="num">Stock</th>
                <th>Nearest Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.total_stock <= p.reorder_level;
                let expBadge = null;
                if (p.nearest_expiry) {
                  const days = Math.floor((new Date(p.nearest_expiry) - new Date()) / 86400000);
                  const status = expiryStatus(days);
                  expBadge = <Pill tone={status.tone}>{formatDate(p.nearest_expiry)}</Pill>;
                }
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setDetailProduct(p.id)}>
                    <td style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.requires_prescription ? <Pill tone="teal" style={{ marginLeft: 6 }}>Rx</Pill> : null}
                      {p.expired_batch_count > 0 ? (
                        <Pill tone="red" style={{ marginLeft: 6 }}>
                          {p.expired_batch_count} expired batch{p.expired_batch_count === 1 ? "" : "es"} in stock
                        </Pill>
                      ) : null}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                    <td className="mono">{p.sku || "—"}</td>
                    <td className="num mono">{formatMoney(p.unit_price)}</td>
                    <td className="num">
                      <Pill tone={isLow ? "red" : "gray"}>{p.total_stock} {p.unit}{p.total_stock === 1 ? "" : "s"}</Pill>
                    </td>
                    <td>{expBadge || <span style={{ color: "var(--ink-faint)" }}>—</span>}</td>
                    <td className="num">
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDetailProduct(p.id); }}>
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onCreated={() => { setShowAddProduct(false); load(); }}
        />
      )}

      {detailProduct && (
        <ProductDetailModal
          productId={detailProduct}
          isManager={isManager}
          onClose={() => setDetailProduct(null)}
          onChanged={load}
        />
      )}
    </AppShell>
  );
}

function AddProductModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "", category: "medicine", sku: "", unit: "unit",
    unit_price: "", reorder_level: "10", requires_prescription: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/products", {
        ...form,
        unit_price: Number(form.unit_price) || 0,
        reorder_level: Number(form.reorder_level) || 10,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Product" onClose={onClose}>
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
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. MED-010" />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Unit</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="tablet, bottle, tube…" />
          </div>
          <div className="field">
            <label>Unit price (K)</label>
            <input required type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Reorder level (alert when stock falls to or below this)</label>
          <input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
        </div>
        <div className="checkbox-row">
          <input
            type="checkbox"
            id="rx"
            checked={form.requires_prescription}
            onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })}
          />
          <label htmlFor="rx">Requires prescription</label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Product"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductDetailModal({ productId, isManager, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [disposeBatch, setDisposeBatch] = useState(null);

  async function load() {
    try {
      const d = await api.get(`/products/${productId}`);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [productId]);

  return (
    <Modal title={data?.product?.name || "Product"} onClose={onClose} width={600}>
      {error && <div className="banner banner-error">{error}</div>}
      {!data ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="gray">{data.product.category}</Pill>
              <Pill tone="gray">{data.product.sku || "No SKU"}</Pill>
              <Pill tone="gray">{formatMoney(data.product.unit_price)} / {data.product.unit}</Pill>
              <Pill tone="gray">Reorder at {data.product.reorder_level}</Pill>
              {data.product.requires_prescription ? <Pill tone="teal">Requires prescription</Pill> : null}
            </div>
            {isManager && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)} style={{ flexShrink: 0 }}>
                Edit Details
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ fontSize: 13.5 }}>Stock Batches</strong>
            {isManager && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowReceive(true)}>
                <IconPlus width={13} height={13} /> Receive Stock
              </button>
            )}
          </div>

          {data.batches.length === 0 ? (
            <div className="empty-state">No batches recorded yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Batch No.</th><th className="num">Qty</th><th>Expiry</th><th>Status</th>{isManager && <th></th>}</tr>
              </thead>
              <tbody>
                {data.batches.map((b) => {
                  const days = b.expiry_date ? Math.floor((new Date(b.expiry_date) - new Date()) / 86400000) : null;
                  const status = expiryStatus(days);
                  const isDisposed = b.status === "disposed";
                  return (
                    <tr key={b.id} style={isDisposed ? { opacity: 0.55 } : undefined}>
                      <td className="mono">{b.batch_number}</td>
                      <td className="num">{b.quantity}{b.disposed_quantity > 0 && (
                        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{b.disposed_quantity} disposed</div>
                      )}</td>
                      <td>{b.expiry_date ? <Pill tone={status.tone}>{formatDate(b.expiry_date)}</Pill> : "—"}</td>
                      <td>
                        {isDisposed ? (
                          <Pill tone="gray">Disposed</Pill>
                        ) : b.is_expired ? (
                          <Pill tone="red">Expired — still active</Pill>
                        ) : (
                          <Pill tone="green">Active</Pill>
                        )}
                      </td>
                      {isManager && (
                        <td className="num">
                          {!isDisposed && b.quantity > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setDisposeBatch(b)}>
                              Dispose
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {showReceive && (
            <ReceiveStockForm
              productId={productId}
              onClose={() => setShowReceive(false)}
              onReceived={() => { setShowReceive(false); load(); onChanged(); }}
            />
          )}

          {showEdit && (
            <EditProductForm
              product={data.product}
              onClose={() => setShowEdit(false)}
              onSaved={() => { setShowEdit(false); load(); onChanged(); }}
            />
          )}

          {disposeBatch && (
            <DisposeBatchForm
              productId={productId}
              batch={disposeBatch}
              onClose={() => setDisposeBatch(null)}
              onDisposed={() => { setDisposeBatch(null); load(); onChanged(); }}
            />
          )}
        </>
      )}
    </Modal>
  );
}

function EditProductForm({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    sku: product.sku || "",
    unit: product.unit,
    unit_price: String(product.unit_price),
    reorder_level: String(product.reorder_level),
    requires_prescription: !!product.requires_prescription,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const priceChanged = Number(form.unit_price) !== product.unit_price;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.put(`/products/${product.id}`, {
        ...form,
        unit_price: Number(form.unit_price) || 0,
        reorder_level: Number(form.reorder_level) || 0,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Product Details" onClose={onClose}>
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
            <label>SKU</label>
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
            <input required type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
        </div>
        {priceChanged && (
          <div className="banner banner-warn" style={{ marginTop: -6 }}>
            Price change: {formatMoney(product.unit_price)} → {formatMoney(Number(form.unit_price) || 0)}.
            This applies to future sales only — past sales keep the price recorded at the time.
          </div>
        )}
        <div className="field">
          <label>Reorder level</label>
          <input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
        </div>
        <div className="checkbox-row">
          <input
            type="checkbox"
            id="rx-edit"
            checked={form.requires_prescription}
            onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })}
          />
          <label htmlFor="rx-edit">Requires prescription</label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DisposeBatchForm({ productId, batch, onClose, onDisposed }) {
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [reason, setReason] = useState(batch.is_expired ? "Expired — removed from sellable stock" : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post(`/products/${productId}/batches/${batch.id}/dispose`, {
        quantity: Number(quantity),
        reason,
      });
      onDisposed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Dispose Stock — Batch ${batch.batch_number}`} onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <div className="banner banner-warn">
        This removes stock from what's sellable and cannot be undone. Use this for
        expired, damaged, or recalled stock that won't be sold.
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Quantity to dispose (of {batch.quantity} available)</label>
          <input required type="number" min="1" max={batch.quantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Reason</label>
          <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Expired 12 days ago, not sold, removed from shelf" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? "Disposing…" : "Confirm Disposal"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiveStockForm({ productId, onClose, onReceived }) {
  const [form, setForm] = useState({ batch_number: "", quantity: "", expiry_date: "", cost_price: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post(`/products/${productId}/batches`, {
        ...form,
        quantity: Number(form.quantity),
        cost_price: Number(form.cost_price) || 0,
      });
      onReceived();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Receive Stock" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Batch number</label>
          <input required value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} autoFocus />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Quantity received</label>
            <input required type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="field">
            <label>Cost price (K, optional)</label>
            <input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Expiry date</label>
          <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Batch"}</button>
        </div>
      </form>
    </Modal>
  );
}
