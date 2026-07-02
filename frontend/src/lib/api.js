// Resolve the API base at runtime from whatever host the page was loaded
// from. This means the app works the same whether you open it as
// http://localhost:5173 or http://<your-lan-ip>:5173 — it always talks to
// the backend on the same machine, on port 4000.
//
// Override with VITE_API_BASE in a .env file if the backend runs elsewhere
// (a different machine, a different port, behind a reverse proxy, etc).
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.protocol}//${window.location.hostname}:4000/api`;

async function request(method, path, body) {
  const token = localStorage.getItem("cps_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
};
