import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, logActivity } from "../db.js";
import { signToken, authRequired } from "../auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const user = db.get("SELECT * FROM users WHERE username = ?", [username]);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = signToken(user);
  logActivity(user.id, "login", { username: user.username });
  res.json({
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      role: user.role,
    },
  });
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;
