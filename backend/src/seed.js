/**
 * Bulk test-data seed.
 *
 * This is separate from seed.js (which sets up a minimal demo). Run this
 * when you want to stress-test the system with a realistic-sized catalogue:
 * ~45 products, varied stock levels (healthy / low / zero), batches spread
 * across expired / expiring-soon / expiring-later / no-expiry, plus some
 * existing sales and restock requests in every status.
 *
 * Usage:
 *   npm run seed:bulk
 *
 * Safe to re-run: products are matched by SKU and skipped if they already
 * exist, batches are matched by (product, batch_number).
 */
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db, initSchema, logActivity } from "./db.js";

initSchema();

// ---------- Users ----------

function upsertUser(full_name, username, password, role) {
  const existing = db.get("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const result = db.run(
    "INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)",
    [full_name, username, hash, role]
  );
  return Number(result.lastInsertRowid);
}

const managerId = upsertUser("Mwansa Banda", "manager", "manager123", "manager");
const pharmacistId = upsertUser("Chanda Mulenga", "pharmacist", "pharma123", "pharmacist");
const pharmacist2Id = upsertUser("Natasha Phiri", "natasha", "pharma123", "pharmacist");
const manager2Id = upsertUser("David Tembo", "david", "manager123", "manager");

console.log("Users ready:");
console.log("  manager   / manager123   (Mwansa Banda)");
console.log("  david     / manager123   (David Tembo, manager)");
console.log("  pharmacist/ pharma123    (Chanda Mulenga)");
console.log("  natasha   / pharma123    (Natasha Phiri, pharmacist)");

// ---------- Products ----------

function upsertProduct(name, category, sku, unit, unit_price, reorder_level, requires_prescription = 0) {
  const existing = db.get("SELECT id FROM products WHERE sku = ?", [sku]);
  if (existing) return existing.id;
  const result = db.run(
    `INSERT INTO products (name, category, sku, unit, unit_price, reorder_level, requires_prescription)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, category, sku, unit, unit_price, reorder_level, requires_prescription]
  );
  return Number(result.lastInsertRowid);
}

// category, name, sku, unit, price, reorderLevel, prescriptionRequired
const MEDICINES = [
  ["Paracetamol 500mg", "MED-001", "tablet", 0.5, 100, 0],
  ["Ibuprofen 400mg", "MED-002", "tablet", 0.6, 80, 0],
  ["Amoxicillin 250mg", "MED-003", "capsule", 1.2, 60, 1],
  ["Amoxiclav 625mg", "MED-004", "tablet", 2.5, 40, 1],
  ["Ciprofloxacin 500mg", "MED-005", "tablet", 1.8, 40, 1],
  ["Metronidazole 400mg", "MED-006", "tablet", 0.8, 50, 0],
  ["Doxycycline 100mg", "MED-007", "capsule", 1.1, 30, 1],
  ["Azithromycin 500mg", "MED-008", "tablet", 3.2, 25, 1],
  ["Cough Syrup 100ml", "MED-009", "bottle", 8.0, 20, 0],
  ["Cetirizine 10mg", "MED-010", "tablet", 0.4, 60, 0],
  ["Loratadine 10mg", "MED-011", "tablet", 0.5, 50, 0],
  ["Omeprazole 20mg", "MED-012", "capsule", 1.0, 50, 0],
  ["Ranitidine 150mg", "MED-013", "tablet", 0.7, 40, 0],
  ["ORS Sachets", "MED-014", "sachet", 1.5, 100, 0],
  ["Zinc Sulphate Tablets", "MED-015", "tablet", 0.6, 60, 0],
  ["Metformin 500mg", "MED-016", "tablet", 0.9, 80, 1],
  ["Glibenclamide 5mg", "MED-017", "tablet", 0.8, 40, 1],
  ["Amlodipine 5mg", "MED-018", "tablet", 1.0, 60, 1],
  ["Atenolol 50mg", "MED-019", "tablet", 0.9, 40, 1],
  ["Losartan 50mg", "MED-020", "tablet", 1.3, 40, 1],
  ["Atorvastatin 20mg", "MED-021", "tablet", 1.6, 30, 1],
  ["Aspirin 75mg", "MED-022", "tablet", 0.3, 100, 0],
  ["Salbutamol Inhaler", "MED-023", "inhaler", 12.0, 15, 1],
  ["Prednisolone 5mg", "MED-024", "tablet", 0.7, 30, 1],
  ["Hydrocortisone Cream 1%", "MED-025", "tube", 5.5, 20, 0],
  ["Clotrimazole Cream", "MED-026", "tube", 4.0, 25, 0],
  ["Fluconazole 150mg", "MED-027", "capsule", 2.2, 30, 0],
  ["Artemether/Lumefantrine (Coartem)", "MED-028", "pack", 6.5, 50, 0],
  ["Quinine Sulphate 300mg", "MED-029", "tablet", 1.4, 30, 0],
  ["Folic Acid 5mg", "MED-030", "tablet", 0.2, 80, 0],
  ["Ferrous Sulphate Tablets", "MED-031", "tablet", 0.3, 80, 0],
  ["Multivitamin Syrup", "MED-032", "bottle", 7.0, 25, 0],
  ["Vitamin C Tablets", "MED-033", "bottle", 6.5, 30, 0],
  ["Vitamin B-Complex Tablets", "MED-034", "bottle", 6.0, 30, 0],
  ["Calcium + Vitamin D3 Tablets", "MED-035", "bottle", 8.5, 20, 0],
  ["Diclofenac Gel", "MED-036", "tube", 4.5, 20, 0],
  ["Paracetamol Syrup (Pediatric)", "MED-037", "bottle", 5.0, 30, 0],
  ["Insulin (Soluble) 10ml", "MED-038", "vial", 18.0, 10, 1],
  ["Diazepam 5mg", "MED-039", "tablet", 0.6, 15, 1],
  ["Tramadol 50mg", "MED-040", "capsule", 1.1, 20, 1],
];

const COSMETICS = [
  ["SPF50 Sunscreen Lotion", "COS-001", "bottle", 15.0, 15, 0],
  ["Moisturizing Hand Cream", "COS-002", "tube", 7.0, 20, 0],
  ["Petroleum Jelly 100g", "COS-003", "tub", 3.0, 30, 0],
  ["Baby Lotion 200ml", "COS-004", "bottle", 9.0, 20, 0],
  ["Antiseptic Liquid Soap", "COS-005", "bottle", 6.0, 25, 0],
  ["Hand Sanitizer 250ml", "COS-006", "bottle", 5.5, 30, 0],
  ["Talcum Powder", "COS-007", "tin", 4.0, 20, 0],
];

const ALL_PRODUCTS = [
  ...MEDICINES.map(([name, sku, unit, price, reorder, rx]) => ({ name, category: "medicine", sku, unit, price, reorder, rx })),
  ...COSMETICS.map(([name, sku, unit, price, reorder, rx]) => ({ name, category: "cosmetic", sku, unit, price, reorder, rx })),
];

const productIds = {};
for (const p of ALL_PRODUCTS) {
  productIds[p.sku] = upsertProduct(p.name, p.category, p.sku, p.unit, p.price, p.reorder, p.rx);
}

console.log(`\nSeeded ${ALL_PRODUCTS.length} products (${MEDICINES.length} medicines, ${COSMETICS.length} cosmetics).`);

// ---------- Stock batches ----------
// Deliberately spread across: already expired, expiring within 14 days,
// expiring within 60 days, expiring far out, and no-expiry. Quantities
// spread across healthy / low (at-or-below reorder) / zero stock so every
// alert and stock-status branch has at least one example.

function addBatch(productId, batchNo, qty, expiryDaysFromNow, costPrice) {
  const exists = db.get(
    "SELECT id FROM stock_batches WHERE product_id = ? AND batch_number = ?",
    [productId, batchNo]
  );
  if (exists) return;
  const expiry = expiryDaysFromNow != null
    ? new Date(Date.now() + expiryDaysFromNow * 86400000).toISOString().slice(0, 10)
    : null;
  db.run(
    `INSERT INTO stock_batches (product_id, batch_number, quantity, expiry_date, cost_price, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, batchNo, qty, expiry, costPrice, managerId]
  );
}

let batchCount = 0;
function batchesFor(sku, specs) {
  // specs: array of [batchSuffix, qty, expiryDays|null, costPrice]
  const pid = productIds[sku];
  specs.forEach(([suffix, qty, expDays, cost], i) => {
    addBatch(pid, `${sku}-${suffix}`, qty, expDays, cost);
    batchCount++;
  });
}

// Healthy stock, far-out expiry — the "everything is fine" baseline
batchesFor("MED-001", [["A1", 600, 400, 0.2], ["A2", 200, 540, 0.2]]);
batchesFor("MED-002", [["A1", 450, 380, 0.25]]);
batchesFor("MED-009", [["A1", 70, 300, 4.0]]);
batchesFor("MED-014", [["A1", 300, 450, 0.6]]);
batchesFor("MED-030", [["A1", 400, 500, 0.08]]);
batchesFor("MED-031", [["A1", 350, 500, 0.1]]);
batchesFor("COS-003", [["A1", 100, 700, 1.2]]);
batchesFor("COS-005", [["A1", 90, 600, 2.5]]);
batchesFor("COS-006", [["A1", 120, 600, 2.0]]);

// Already expired (negative days) — should show as "Expired" in red
batchesFor("MED-003", [["X1", 25, -5, 0.6], ["X2", 180, 200, 0.6]]); // some expired, some fine
batchesFor("MED-037", [["X1", 10, -2, 1.5]]);
batchesFor("COS-004", [["X1", 8, -10, 3.0]]);

// Expiring within 14 days — should be red "Xd left"
batchesFor("MED-004", [["B1", 35, 10, 1.0]]);
batchesFor("MED-008", [["B1", 18, 6, 1.4]]);
batchesFor("MED-023", [["B1", 12, 9, 8.0]]);
batchesFor("MED-038", [["B1", 6, 4, 14.0]]);

// Expiring within 60 days — should be amber
batchesFor("MED-005", [["C1", 60, 35, 0.9]]);
batchesFor("MED-007", [["C1", 22, 28, 0.5]]);
batchesFor("MED-024", [["C1", 28, 45, 0.4]]);
batchesFor("MED-027", [["C1", 26, 50, 1.1]]);
batchesFor("MED-039", [["C1", 13, 40, 0.3]]);

// Below reorder level (low stock) but expiry is fine
batchesFor("MED-006", [["D1", 18, 250, 0.4]]); // reorder 50
batchesFor("MED-021", [["D1", 12, 300, 0.9]]); // reorder 30
batchesFor("MED-025", [["D1", 9, 280, 2.5]]); // reorder 20
batchesFor("MED-032", [["D1", 14, 320, 3.5]]); // reorder 25
batchesFor("MED-033", [["D1", 11, 350, 3.0]]); // reorder 30 (already used in old seed too, fine if duplicate skipped)
batchesFor("MED-040", [["D1", 7, 200, 0.6]]); // reorder 20
batchesFor("COS-001", [["D1", 6, 400, 8.0]]); // reorder 15
batchesFor("COS-002", [["D1", 5, 420, 3.5]]); // reorder 20

// Zero stock — product exists, no batches at all (out of stock entirely)
// (MED-010 through a few others intentionally left batch-less below)

// Everything else gets one reasonable, healthy batch with a varied cost
const remainingSkus = ALL_PRODUCTS.map((p) => p.sku).filter((sku) => {
  const pid = productIds[sku];
  const has = db.get("SELECT COUNT(*) as c FROM stock_batches WHERE product_id = ?", [pid]).c;
  return has === 0;
});

// Leave a handful genuinely at zero stock to test "out of stock" in POS
const ZERO_STOCK_SKUS = new Set(["MED-010", "MED-017", "MED-029", "COS-007"]);

for (const sku of remainingSkus) {
  if (ZERO_STOCK_SKUS.has(sku)) continue; // leave with no batch -> 0 stock
  const pid = productIds[sku];
  const product = ALL_PRODUCTS.find((p) => p.sku === sku);
  const qty = 40 + Math.floor(Math.random() * 200);
  const expDays = 120 + Math.floor(Math.random() * 400);
  addBatch(pid, `${sku}-G1`, qty, expDays, Number((product.price * 0.45).toFixed(2)));
  batchCount++;
}

console.log(`Seeded ${batchCount} stock batches across expired / expiring-soon / low-stock / zero-stock / healthy scenarios.`);
console.log(`Zero-stock products (for testing "out of stock" in POS): ${[...ZERO_STOCK_SKUS].join(", ")}`);

// ---------- Sales history ----------
// A spread of sales over the last ~10 days so the revenue-by-day chart and
// top-products report have real data to show.

function recordSale(cashierId, daysAgo, items, paymentMethod, customerName) {
  const saleRef = "SALE-" + uuidv4().slice(0, 8).toUpperCase();
  let total = 0;
  const lines = [];

  for (const { sku, quantity } of items) {
    const productId = productIds[sku];
    const product = db.get("SELECT * FROM products WHERE id = ?", [productId]);
    let remaining = quantity;
    const batches = db.all(
      `SELECT * FROM stock_batches WHERE product_id = ? AND quantity > 0
       ORDER BY (expiry_date IS NULL), expiry_date ASC, received_date ASC`,
      [productId]
    );
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      if (take <= 0) continue;
      db.run("UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?", [take, batch.id]);
      const lineTotal = take * product.unit_price;
      total += lineTotal;
      lines.push({ product_id: productId, batch_id: batch.id, quantity: take, unit_price: product.unit_price, line_total: lineTotal });
      remaining -= take;
    }
    // If insufficient stock to fulfill the seeded sale, just sell what's available silently.
  }

  if (lines.length === 0) return; // nothing could be sold, skip

  const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const result = db.run(
    `INSERT INTO sales (sale_ref, cashier_id, total_amount, payment_method, customer_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [saleRef, cashierId, total, paymentMethod, customerName, createdAt]
  );
  const saleId = Number(result.lastInsertRowid);
  for (const line of lines) {
    db.run(
      `INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)`,
      [saleId, line.product_id, line.batch_id, line.quantity, line.unit_price, line.line_total]
    );
  }
  logActivity(cashierId, "sale_recorded", { sale_id: saleId, sale_ref: saleRef, total_amount: total });
}

const existingSales = db.get("SELECT COUNT(*) as c FROM sales").c;
if (existingSales < 5) {
  recordSale(pharmacistId, 9, [{ sku: "MED-001", quantity: 20 }, { sku: "MED-009", quantity: 2 }], "cash", "Walk-in");
  recordSale(pharmacist2Id, 8, [{ sku: "MED-033", quantity: 1 }, { sku: "COS-001", quantity: 1 }], "mobile_money", "Brenda K.");
  recordSale(pharmacistId, 7, [{ sku: "MED-016", quantity: 30 }], "insurance", "James M.");
  recordSale(pharmacist2Id, 6, [{ sku: "MED-002", quantity: 10 }, { sku: "MED-012", quantity: 14 }], "cash", "Walk-in");
  recordSale(pharmacistId, 5, [{ sku: "MED-028", quantity: 3 }], "cash", "Walk-in");
  recordSale(pharmacist2Id, 4, [{ sku: "MED-001", quantity: 15 }, { sku: "MED-014", quantity: 5 }], "mobile_money", "Patricia N.");
  recordSale(pharmacistId, 3, [{ sku: "MED-009", quantity: 1 }, { sku: "MED-037", quantity: 1 }], "cash", "Walk-in");
  recordSale(pharmacist2Id, 2, [{ sku: "MED-018", quantity: 30 }], "insurance", "Robert C.");
  recordSale(pharmacistId, 1, [{ sku: "MED-001", quantity: 8 }, { sku: "COS-005", quantity: 2 }], "cash", "Walk-in");
  recordSale(pharmacist2Id, 0, [{ sku: "MED-033", quantity: 2 }, { sku: "MED-034", quantity: 1 }], "card", "Mercy L.");
  console.log("\nSeeded 10 historical sales across the last 9 days.");
} else {
  console.log("\nSales already present, skipped seeding historical sales.");
}

// ---------- Restock requests in every status ----------

function requestExists(productId, requestedBy, status) {
  return db.get(
    "SELECT id FROM restock_requests WHERE product_id = ? AND requested_by = ? AND status = ?",
    [productId, requestedBy, status]
  );
}

function seedRestockRequest(sku, requestedBy, qty, reason, status, reviewedBy, reviewNote) {
  const productId = productIds[sku];
  if (requestExists(productId, requestedBy, status)) return;
  const result = db.run(
    `INSERT INTO restock_requests (product_id, requested_by, requested_quantity, reason, status, reviewed_by, review_note, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId, requestedBy, qty, reason, status,
      status === "pending" ? null : reviewedBy,
      status === "pending" ? null : reviewNote,
      status === "pending" ? null : new Date().toISOString().slice(0, 19).replace("T", " "),
    ]
  );
  logActivity(requestedBy, "restock_requested", { request_id: Number(result.lastInsertRowid), product_id: productId, requested_quantity: qty });
  if (status !== "pending") {
    logActivity(reviewedBy, "restock_reviewed", { request_id: Number(result.lastInsertRowid), decision: status });
  }
}

seedRestockRequest("MED-006", pharmacistId, 200, "Stock below reorder level, fast-moving item", "pending", null, null);
seedRestockRequest("MED-021", pharmacist2Id, 100, "Chronic disease patients waiting", "pending", null, null);
seedRestockRequest("COS-001", pharmacistId, 60, "Seasonal demand increasing", "pending", null, null);
seedRestockRequest("MED-025", pharmacist2Id, 80, "Low stock, frequently requested", "approved", managerId, "Approved, please order from main supplier");
seedRestockRequest("MED-032", pharmacistId, 50, "Running low", "approved", manager2Id, "Approved — include in this week's order");
seedRestockRequest("MED-040", pharmacist2Id, 40, "Below reorder threshold", "rejected", managerId, "Hold off — recent guidance restricts quantities, request a smaller batch");
seedRestockRequest("COS-002", pharmacistId, 50, "Customer demand", "rejected", manager2Id, "Sufficient stock incoming from existing order, duplicate request");
seedRestockRequest("MED-033", pharmacist2Id, 60, "Low stock", "fulfilled", managerId, "Approved and received");

console.log("Seeded restock requests across pending / approved / rejected / fulfilled.");

console.log("\nBulk seed complete.");
console.log("Tip: re-run 'npm run seed:bulk' any time — it skips records that already exist.");