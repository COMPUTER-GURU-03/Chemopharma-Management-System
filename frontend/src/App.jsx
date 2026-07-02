import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Sales from "./pages/Sales.jsx";
import Restock from "./pages/Restock.jsx";
import ProductRequests from "./pages/ProductRequests.jsx";
import Alerts from "./pages/Alerts.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";

function ProtectedRoute({ children, managerOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (managerOnly && user.role !== "manager") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/product-requests" element={<ProtectedRoute><ProductRequests /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/restock" element={<ProtectedRoute><Restock /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute managerOnly><Reports /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute managerOnly><Users /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
