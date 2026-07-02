import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">CP</div>
        <h1>Chemo Pharm Store</h1>
        <p>Sign in to manage stock, sales, and restocking.</p>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-hint">
          <strong>Demo accounts</strong><br />
          Manager — manager / manager123<br />
          Pharmacist — pharmacist / pharma123
        </div>
      </div>
    </div>
  );
}
