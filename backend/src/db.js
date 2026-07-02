import pkg from "node-sqlite3-wasm";
const { Database } = pkg;
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "db", "chemo_pharm.sqlite");

export const db = new Database(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager','pharmacist')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('medicine','cosmetic')),
    sku TEXT UNIQUE,
    unit TEXT NOT NULL DEFAULT 'unit',
    unit_price REAL NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    requires_prescription INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Each batch is a distinct intake of stock for a product, with its own
  -- batch number, expiry date and quantity. This is what lets us track
  -- expiry per-batch rather than per-product.
  --
  -- status: 'active' (sellable) or 'disposed' (written off — expired or
  -- damaged stock pulled out of sellable inventory). We do NOT rely on
  -- expiry_date alone to stop a batch being sold: a batch is only removed
  -- from what the sales screen offers once someone actually confirms the
  -- disposal, because FEFO ordering at checkout is a *default*, not a
  -- guarantee — staff can and do sell out of order, so expired stock needs
  -- an explicit, auditable removal step rather than silently ceasing to
  -- exist once the date passes.
  CREATE TABLE IF NOT EXISTS stock_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    expiry_date TEXT,
    received_date TEXT NOT NULL DEFAULT (datetime('now')),
    cost_price REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disposed')),
    disposed_quantity INTEGER NOT NULL DEFAULT 0,
    disposed_reason TEXT,
    disposed_by INTEGER REFERENCES users(id),
    disposed_at TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_ref TEXT NOT NULL UNIQUE,
    cashier_id INTEGER NOT NULL REFERENCES users(id),
    total_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    customer_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    batch_id INTEGER REFERENCES stock_batches(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );

  -- Restock requests: pharmacist raises, manager approves/rejects.
  -- On approval, a new stock_batch should be created (handled in app logic).
  CREATE TABLE IF NOT EXISTS restock_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    requested_quantity INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled')),
    reviewed_by INTEGER REFERENCES users(id),
    review_note TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('medicine','cosmetic')),
    sku TEXT UNIQUE,
    unit TEXT NOT NULL DEFAULT 'unit',
    unit_price REAL NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    requires_prescription INTEGER NOT NULL DEFAULT 0,
    batch_number TEXT,
    quantity INTEGER,
    expiry_date TEXT,
    cost_price REAL DEFAULT 0,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    review_note TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_batches_product ON stock_batches(product_id);
  CREATE INDEX IF NOT EXISTS idx_batches_expiry ON stock_batches(expiry_date);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_restock_status ON restock_requests(status);
  `);

  migrateExistingDatabase();
}

// Handles the case where the DB file already exists from before these
// columns were introduced. SQLite's CREATE TABLE IF NOT EXISTS won't add
// new columns to an existing table, so we check and ALTER as needed.
function migrateExistingDatabase() {
  const columns = db.all("PRAGMA table_info(stock_batches)").map((c) => c.name);
  const alterations = [
    ["status", "TEXT NOT NULL DEFAULT 'active'"],
    ["disposed_quantity", "INTEGER NOT NULL DEFAULT 0"],
    ["disposed_reason", "TEXT"],
    ["disposed_by", "INTEGER REFERENCES users(id)"],
    ["disposed_at", "TEXT"],
  ];
  for (const [name, def] of alterations) {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE stock_batches ADD COLUMN ${name} ${def};`);
    }
  }
}

export function logActivity(userId, action, details) {
  db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)",
    [userId ?? null, action, details ? JSON.stringify(details) : null]
  );
}
