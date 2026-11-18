const TOKEN_KEY = "fa_token";
// عنوان الباك: فارغ محلياً (Vite proxy) أو VITE_API_URL على Render Static Site
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "content-type": "application/json" };
  const t = getToken();
  if (auth && t) headers.authorization = `Bearer ${t}`;
  const res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "request_failed"); e.status = res.status; e.data = data; throw e; }
  return data;
}
export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: "POST", body });
export const patch = (p, body) => api(p, { method: "PATCH", body });
export const put = (p, body) => api(p, { method: "PUT", body });
export const del = (p) => api(p, { method: "DELETE" });
/** روابط الصور المخزّنة بالسيرفر (/api/img/...) تحتاج عنوان الباك */
export const imgSrc = (u) => (u && u.startsWith("/api/") ? `${API_BASE}${u}` : u || "");
