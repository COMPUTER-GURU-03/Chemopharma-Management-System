import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import Modal from "../components/Modal.jsx";
import Pill from "../components/Pill.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { IconPlus } from "../components/Icons.jsx";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get("/users");
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}/status`, { is_active: user.is_active ? 0 : 1 });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Staff Accounts" subtitle="Manage logins and roles for managers and pharmacists">
      {error && <div className="banner banner-error">{error}</div>}

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus width={15} height={15} /> Add Staff Account
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td className="mono">{u.username}</td>
                  <td style={{ textTransform: "capitalize" }}><Pill tone="teal">{u.role}</Pill></td>
                  <td>{u.is_active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Disabled</Pill>}</td>
                  <td>{formatDate(u.created_at)}</td>
                  <td className="num" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setResetTarget(u)}>Reset password</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(u)}>
                      {u.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />
      )}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onDone={() => setResetTarget(null)} />
      )}
    </AppShell>
  );
}

function AddUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: "", username: "", password: "", role: "pharmacist" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/users", form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Staff Account" onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
        </div>
        <div className="field">
          <label>Username</label>
          <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="field">
          <label>Temporary password</label>
          <input required type="password" minLength={4} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="pharmacist">Pharmacist</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Account"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}/password`, { password });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.full_name}`} onClose={onClose}>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>New password</label>
          <input required type="password" minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Reset Password"}</button>
        </div>
      </form>
    </Modal>
  );
}
