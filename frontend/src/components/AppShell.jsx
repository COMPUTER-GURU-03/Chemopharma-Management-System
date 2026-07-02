import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import {
  IconDashboard, IconBox, IconCart, IconPill, IconRefresh, IconAlert, IconReport, IconUsers, IconLogout,
} from "./Icons.jsx";

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingRestocks, setPendingRestocks] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/reports/summary").then((s) => {
      if (cancelled) return;
      setPendingRestocks(s.pending_restocks);
      setAlertCount(s.low_stock_count + s.expiring_soon_count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const isManager = user?.role === "manager";

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">CP</div>
          <div className="sidebar-brand-text">
            <strong>Chemo Pharm</strong>
            <span>Store Management</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconDashboard /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/inventory" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconBox /> <span>Inventory</span>
          </NavLink>
          <NavLink to="/product-requests" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconPill /> <span>Requests</span>
          </NavLink>
          <NavLink to="/sales" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconCart /> <span>Sales</span>
          </NavLink>
          <NavLink to="/restock" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconRefresh /> <span>Restocking</span>
            {pendingRestocks > 0 && <span className="badge">{pendingRestocks}</span>}
          </NavLink>
          <NavLink to="/alerts" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
            <IconAlert /> <span>Alerts</span>
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </NavLink>
          {isManager && (
            <NavLink to="/reports" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
              <IconReport /> <span>Reports</span>
            </NavLink>
          )}
          {isManager && (
            <NavLink to="/users" onClick={() => setSidebarOpen(false)} className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}>
              <IconUsers /> <span>Staff Accounts</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div>
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <IconLogout width={14} height={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button 
            className="sidebar-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
