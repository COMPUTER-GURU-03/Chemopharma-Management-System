import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Modal from "../components/Modal.jsx";
import { api } from "../lib/api.js";
import { formatMoney, formatDate } from "../lib/format.js";
import { IconSearch, IconTrash, IconCart } from "../components/Icons.jsx";

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // { product, quantity }
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [sales, setSales] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);

  async function loadProducts() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const data = await api.get(`/products?${params.toString()}`);
    setProducts(data.products);
  }

  async function loadSales() {
    const data = await api.get("/sales?limit=15");
    setSales(data.sales);
  }

  useEffect(() => { loadProducts(); }, [search]);
  useEffect(() => { loadSales(); }, []);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId, qty) {
    setCart((prev) => prev.map((l) => l.product.id === productId ? { ...l, quantity: qty } : l));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const total = cart.reduce((sum, l) => sum + l.quantity * l.product.unit_price, 0);

  async function completeSale() {
    setError("");
    setSuccess("");
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const result = await api.post("/sales", {
        customer_name: customerName || null,
        payment_method: paymentMethod,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      setReceiptSale({ ...result, items: cart, customer_name: customerName, payment_method: paymentMethod });
      setCart([]);
      setCustomerName("");
      setSuccess(`Sale ${result.sale_ref} recorded — ${formatMoney(result.total_amount)}`);
      loadProducts();
      loadSales();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Sales" subtitle="Record transactions and review recent sales">
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Left: product picker */}
        <div className="card">
          <div className="card-header">
            <h2>Products</h2>
          </div>
          <div style={{ padding: "12px 20px 0" }}>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <input type="text" placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th className="num">Price</th><th className="num">In Stock</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="num mono">{formatMoney(p.unit_price)}</td>
                  <td className="num">{p.total_stock}</td>
                  <td className="num">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={p.total_stock <= 0}
                      onClick={() => addToCart(p)}
                    >
                      {p.total_stock <= 0 ? "Out of stock" : "Add"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: cart */}
        <div className="card">
          <div className="card-header">
            <h2><IconCart width={15} height={15} style={{ marginRight: 6, verticalAlign: -2 }} />Current Sale</h2>
          </div>
          <div className="card-pad">
            {error && <div className="banner banner-error">{error}</div>}
            {success && <div className="banner banner-success">{success}</div>}

            {cart.length === 0 ? (
              <div className="empty-state">Add products from the left to start a sale.</div>
            ) : (
              <>
                {cart.map((l) => (
                  <div key={l.product.id} className="cart-line">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{l.product.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{formatMoney(l.product.unit_price)} each</div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={l.product.total_stock}
                      value={l.quantity}
                      onChange={(e) => updateQty(l.product.id, Math.max(1, Number(e.target.value)))}
                      style={{ width: 56, padding: "5px 6px", border: "1px solid var(--border-strong)", borderRadius: 6 }}
                    />
                    <div className="mono" style={{ width: 70, textAlign: "right", fontWeight: 600 }}>
                      {formatMoney(l.quantity * l.product.unit_price)}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(l.product.id)}>
                      <IconTrash width={14} height={14} />
                    </button>
                  </div>
                ))}

                <div className="field" style={{ marginTop: 16 }}>
                  <label>Customer name (optional)</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in" />
                </div>
                <div className="field">
                  <label>Payment method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card</option>
                    <option value="insurance">Insurance</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--border)", marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{formatMoney(total)}</span>
                </div>

                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={completeSale} disabled={submitting}>
                  {submitting ? "Recording…" : "Complete Sale"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="section-title">Recent Sales</div>
      <div className="card">
        {sales.length === 0 ? (
          <div className="empty-state">No sales yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Reference</th><th>Cashier</th><th>Customer</th><th>Payment</th><th>Date</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.sale_ref}</td>
                  <td>{s.cashier_name}</td>
                  <td>{s.customer_name || "Walk-in"}</td>
                  <td style={{ textTransform: "capitalize" }}>{s.payment_method.replace("_", " ")}</td>
                  <td>{formatDate(s.created_at)}</td>
                  <td className="num mono">{formatMoney(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {receiptSale && (
        <Modal title="Sale Complete" onClose={() => setReceiptSale(null)}>
          <div style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink-faint)" }}>{receiptSale.sale_ref}</div>
          </div>
          {receiptSale.items.map((l) => (
            <div key={l.product.id} className="cart-line">
              <div style={{ flex: 1 }}>{l.product.name} × {l.quantity}</div>
              <div className="mono">{formatMoney(l.quantity * l.product.unit_price)}</div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontWeight: 700 }}>
            <span>Total</span>
            <span className="mono">{formatMoney(receiptSale.total_amount)}</span>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setReceiptSale(null)}>Done</button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
