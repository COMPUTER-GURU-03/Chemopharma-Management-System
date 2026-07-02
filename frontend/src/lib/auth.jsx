import { createContext, useContext, useState, useCallback } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("cps_user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (username, password) => {
    const data = await api.post("/auth/login", { username, password });
    localStorage.setItem("cps_token", data.token);
    localStorage.setItem("cps_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("cps_token");
    localStorage.removeItem("cps_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
