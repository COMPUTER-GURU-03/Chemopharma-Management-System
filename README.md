# Chemo Pharm Store — Pharmacy Management System

A computerized pharmacy management system built for Chemo Pharm Store, covering
user management, batch-level inventory tracking, sales, a manager-approved
restocking workflow, expiry monitoring, and reporting.

# Testing

## Stack

- **Backend:** Node.js, Express, SQLite (via `node-sqlite3-wasm`, no native
  build step required), JWT authentication, bcrypt password hashing.
- **Frontend:** React (Vite), React Router, Recharts for reporting charts.

## Project structure

```
chemo-pharm/
├── backend/
│   ├── src/
│   │   ├── db.js            # schema + connection
│   │   ├── auth.js          # JWT + role middleware
│   │   ├── seed.js          # demo data
│   │   ├── server.js        # entry point
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── users.js
│   │       ├── products.js
│   │       ├── sales.js
│   │       ├── restock.js
│   │       └── reports.js
│   └── db/                  # SQLite file lives here (created on first run)
└── frontend/
    └── src/
        ├── pages/            # Dashboard, Inventory, Sales, Restock, Alerts, Reports, Users, Login
        ├── components/       # AppShell, Modal, Pill, Icons
        └── lib/              # api client, auth context, formatters
```

## Getting started

### Root workspace

```bash
npm install
npm run install:all
npm run seed       # creates the SQLite DB and demo users/products
npm run dev
```

This runs both backend and frontend together from the project root.

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates the SQLite DB and demo users/products
npm start        # runs on http://localhost:4000
```

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev       # runs on http://localhost:5173
```

Open http://localhost:5173 in your browser.

### Demo accounts (created by `npm run seed`)

| Role       | Username    | Password    |
|------------|-------------|-------------|
| Manager    | manager     | manager123  |
| Pharmacist | pharmacist  | pharma123   |

Change these immediately if you deploy this anywhere beyond a demo —
passwords are stored hashed (bcrypt), but the seed values are obviously not
production-safe.

## Feature mapping (to the original objectives)

1. **User management & role-based access** — `backend/src/auth.js`,
   `routes/users.js`. JWT-based login; `manager` and `pharmacist` roles;
   managers can create/disable accounts and reset passwords. Route-level
   `requireRole()` middleware enforces permissions on every protected
   endpoint, not just in the UI.
2. **Product & inventory management** — `routes/products.js`. Products
   (medicine/cosmetic) hold static info (price, reorder level, SKU);
   `stock_batches` track each intake separately with its own batch number,
   quantity, and expiry date, so the same product can have multiple batches
   expiring at different times.
3. **Sales management** — `routes/sales.js`. Recording a sale validates
   stock availability, deducts from the *earliest-expiring* batch first
   (FEFO — first-expiry-first-out), and stores a line-item breakdown per
   sale.
4. **Restocking workflow** — `routes/restock.js`. Pharmacists (or managers)
   submit a `restock_requests` row; managers approve or reject; approving
   doesn't auto-create stock — the manager then receives the actual batch via
   "Receive Stock," which can reference the originating request and marks it
   `fulfilled`. This keeps a deliberate human check between "approved" and
   "stock physically added."
5. **Expiry monitoring** — `GET /products/alerts/expiry?days=N` surfaces any
   batch with remaining stock expiring within N days (default 60), with
   visual severity (red ≤14 days, amber ≤60, green beyond). Shown on the
   Dashboard and a dedicated Alerts page.
6. **Reporting** — `routes/reports.js` + the Reports page (manager-only):
   daily revenue chart, top products, full stock status, restocking history,
   and a system activity log.
7. **Data integrity & logging** — every meaningful write (login, sale,
   stock received, restock requested/reviewed, user created/disabled,
   password reset) is recorded in `activity_log` with the acting user,
   viewable under Reports → Activity Log. Foreign keys and CHECK constraints
   are enforced at the SQLite schema level.

## Notes on design choices

- **FEFO deduction:** when a sale is recorded, stock is deducted from the
  batch with the nearest expiry date first, not the most recently received.
  This is standard pharmacy practice and reduces wastage.
- **Restock requests don't auto-fulfill on approval.** Approval signals "go
  ahead and order/collect this," but the actual batch (with its real batch
  number and expiry date) is only added once it physically arrives, via
  "Receive Stock." This mirrors how a real pharmacy operates and avoids
  phantom stock entering the system before it's on the shelf.
- **Soft delete for products/users:** products are deactivated
  (`is_active = 0`) rather than hard-deleted, since sales history references
  them and that history must remain intact for reporting.

## Known limitations / suggested next steps

- No password complexity rules or forced password change on first login.
- No pagination on long tables (fine for a single-branch pharmacy's typical
  data volume, but worth adding if usage grows).
- No printable/PDF receipts yet — the on-screen sale confirmation is the
  only record beyond the database.
- Single-branch only; multi-branch support would need a `branch_id` on
  products, batches, and sales.
