import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import { initSchema } from "./db.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import restockRoutes from "./routes/restock.js";
import reportRoutes from "./routes/reports.js";

dotenv.config();
initSchema();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/restock", restockRoutes);
app.use("/api/reports", reportRoutes);
import productRequestRoutes from "./routes/productRequests.js";
app.use("/api/product-requests", productRequestRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, service: "Chemo Pharm Store API" }));

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const PORT = process.env.PORT || 4000;
// Bind to 0.0.0.0 explicitly so the API is reachable from other devices on
// the same network, not just from this machine.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nChemo Pharm Store API running:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const addr of getLanAddresses()) {
    console.log(`  Network: http://${addr}:${PORT}`);
  }
  console.log("");
});
