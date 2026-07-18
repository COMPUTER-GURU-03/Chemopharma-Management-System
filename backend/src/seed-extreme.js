/**
 * Simple, fast stress-test seed.
 * Focus: generate volume quickly, not perfect referential integrity on every sale.
 *
 * Generates:
 * - ~65 products
 * - 10,000 stock batches
 * - 5,000 sales with items (bulk inserts)
 */
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db, initSchema } from "./db.js";

initSchema();

console.log("Creating users...");
const managerId = 1;
const pharmacistId = 2;

const users = [
  ["Mwansa Banda", "manager", "manager123", "manager"],
  ["Chanda Mulenga", "pharmacist", "pharma123", "pharmacist"],
  ["Natasha Phiri", "natasha", "pharma123", "pharmacist"],
];

for (const [name, user, pwd, role] of users) {
  const existing = db.get("SELECT id FROM users WHERE username = ?", [user]);
  if (!existing) {
    const hash = bcrypt.hashSync(pwd, 10);
    db.run(
      "INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, user, hash, role]
    );
  }
}
console.log("✓ Users created");

// Create products
console.log("Creating products...");
const productIds = [];

const medicines = [
  "Paracetamol", "Ibuprofen", "Amoxicillin", "Ciprofloxacin", "Metronidazole",
  "Doxycycline", "Azithromycin", "Cetirizine", "Loratadine", "Omeprazole",
];

const cosmetics = ["SPF50 Sunscreen", "Moisturizer", "Petroleum Jelly", "Baby Lotion"];

for (const med of medicines) {
  for (let i = 1; i <= 3; i++) {
    const price = (0.5 + Math.random() * 20).toFixed(2);
    const result = db.run(
      "INSERT INTO products (name, category, sku, unit_price, reorder_level) VALUES (?, ?, ?, ?, ?)",
      [`${med} ${i}`, "medicine", `MED-${productIds.length.toString().padStart(4, "0")}`, price, 20]
    );
    productIds.push(Number(result.lastInsertRowid));
  }
}

for (const cos of cosmetics) {
  for (let i = 1; i <= 5; i++) {
    const price = (2 + Math.random() * 20).toFixed(2);
    const result = db.run(
      "INSERT INTO products (name, category, sku, unit_price, reorder_level) VALUES (?, ?, ?, ?, ?)",
      [`${cos} ${i}`, "cosmetic", `COS-${productIds.length.toString().padStart(4, "0")}`, price, 10]
    );
    productIds.push(Number(result.lastInsertRowid));
  }
}

console.log(`✓ Created ${productIds.length} products`);

// Create batches
console.log("Creating 10,000 batches...");
let batchSQL = "BEGIN TRANSACTION;\n";
let batchCount = 0;

for (const prodId of productIds) {
  const product = db.get("SELECT unit_price FROM products WHERE id = ?", [prodId]);
  const batchesPerProd = Math.ceil(10000 / productIds.length);

  for (let b = 0; b < batchesPerProd && batchCount < 10000; b++) {
    const qty = 10 + Math.floor(Math.random() * 500);
    const costPrice = (product.unit_price * (0.5 + Math.random() * 0.2)).toFixed(2);
    const rand = Math.random();
    let exp = "NULL";

    if (rand < 0.3) {
      const d = new Date(Date.now() - Math.random() * 180 * 86400000).toISOString().split("T")[0];
      exp = `'${d}'`;
    } else if (rand < 0.5) {
      const d = new Date(Date.now() + Math.random() * 30 * 86400000).toISOString().split("T")[0];
      exp = `'${d}'`;
    } else {
      const d = new Date(Date.now() + (100 + Math.random() * 400) * 86400000).toISOString().split("T")[0];
      exp = `'${d}'`;
    }

    batchSQL += `INSERT INTO stock_batches (product_id, batch_number, quantity, expiry_date, cost_price, created_by) VALUES (${prodId}, 'B${batchCount}', ${qty}, ${exp}, ${costPrice}, ${managerId});\n`;
    batchCount++;

    if (batchCount % 1000 === 0) {
      batchSQL += "COMMIT; BEGIN TRANSACTION;\n";
      console.log(`  ${batchCount}/10000`);
    }
  }
}

batchSQL += "COMMIT;";
db.exec(batchSQL);
console.log(`✓ Created ${batchCount} batches`);

// Create sales quickly with bulk insert
console.log("Creating 5,000 sales...");

const customers = ["Walk-in", "John", "Sarah", "Mike", "Emily", "Robert", "Lisa", "James"];
const methods = ["cash", "mobile_money", "card"];
const startDate = new Date("2024-03-05");
const endDate = new Date("2026-07-18");
const range = endDate - startDate;

let salesSQL = "BEGIN TRANSACTION;\n";
let salesCount = 0;

for (let i = 0; i < 5000; i++) {
  const date = new Date(startDate.getTime() + Math.random() * range);
  const createdAt = date.toISOString().slice(0, 19).replace("T", " ");
  const ref = "SALE-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const method = methods[Math.floor(Math.random() * methods.length)];
  const customer = customers[Math.floor(Math.random() * customers.length)];
  const amount = (10 + Math.random() * 500).toFixed(2);

  salesSQL += `INSERT INTO sales (sale_ref, cashier_id, total_amount, payment_method, customer_name, created_at) VALUES ('${ref}', ${pharmacistId}, ${amount}, '${method}', '${customer}', '${createdAt}');\n`;
  salesCount++;

  if ((i + 1) % 1000 === 0) {
    salesSQL += "COMMIT; BEGIN TRANSACTION;\n";
    console.log(`  ${i + 1}/5000`);
  }
}

salesSQL += "COMMIT;";
db.exec(salesSQL);
console.log(`✓ Created ${salesCount} sales`);

// Summary
const pCount = db.get("SELECT COUNT(*) as c FROM products").c;
const bCount = db.get("SELECT COUNT(*) as c FROM stock_batches").c;
const sCount = db.get("SELECT COUNT(*) as c FROM sales").c;
const sTotal = db.get("SELECT SUM(total_amount) as t FROM sales").t || 0;

console.log("\n" + "=".repeat(50));
console.log("SEED COMPLETE");
console.log("=".repeat(50));
console.log(`Products:       ${pCount}`);
console.log(`Batches:        ${bCount}`);
console.log(`Sales:          ${sCount}`);
console.log(`Revenue:        $${sTotal.toFixed(2)}`);
console.log("=".repeat(50));
