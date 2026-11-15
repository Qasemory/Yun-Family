import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api.js";

const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: !!getToken(), user: null, members: [], unread: 0 });
  const refresh = useCallback(async () => {
    if (!getToken()) { setState({ loading: false, user: null, members: [], unread: 0 }); return; }
    try { const me = await api("/auth/me"); setState({ loading: false, ...me }); }
    catch { setToken(null); setState({ loading: false, user: null, members: [], unread: 0 }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (name, secret, code) => {
    const r = await api("/auth/login", { method: "POST", body: { name, secret, code: code || undefined }, auth: false });
    setToken(r.token); await refresh(); return r.user;
  };
  const logout = () => { setToken(null); setState({ loading: false, user: null, members: [], unread: 0 }); };
  const lang = state.user?.uiLanguage || "ar";
  const isParent = ["owner", "admin"].includes(state.user?.role);
  const isChild = ["child", "teen_adult"].includes(state.user?.role);
  return <Ctx.Provider value={{ ...state, login, logout, refresh, lang, isParent, isChild }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
