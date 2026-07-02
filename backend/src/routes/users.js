import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, logActivity } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

const router = Router();
router.use(authRequired);

// List users — manager only
router.get("/", requireRole("manager"), (req, res) => {
  const users = db.all(
    "SELECT id, full_name, username, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  res.json({ users });
});

// Create a user — manager only
router.post("/", requireRole("manager"), (req, res) => {
  const { full_name, username, password, role } = req.body;
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!["manager", "pharmacist"].includes(role)) {
    return res.status(400).json({ error: "Role must be manager or pharmacist." });
  }
  const existing = db.get("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) {
    return res.status(409).json({ error: "That username is already taken." });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.run(
    "INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)",
    [full_name, username, hash, role]
  );
  logActivity(req.user.id, "user_created", { created_user_id: Number(result.lastInsertRowid), username, role });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// Activate / deactivate a user — manager only
router.patch("/:id/status", requireRole("manager"), (req, res) => {
  const { is_active } = req.body;
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: "You can't change your own access status." });
  }
  const user = db.get("SELECT id FROM users WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ error: "User not found." });
  db.run("UPDATE users SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, id]);
  logActivity(req.user.id, "user_status_changed", { target_user_id: id, is_active: !!is_active });
  res.json({ ok: true });
});

// Reset a user's password — manager only
router.patch("/:id/password", requireRole("manager"), (req, res) => {
  const { password } = req.body;
  const id = Number(req.params.id);
  if (!password || password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  const user = db.get("SELECT id FROM users WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ error: "User not found." });
  const hash = bcrypt.hashSync(password, 10);
  db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
  logActivity(req.user.id, "password_reset", { target_user_id: id });
  res.json({ ok: true });
});

export default router;
