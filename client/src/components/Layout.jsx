import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { t, dirFor } from "../lib/i18n.js";

const Icon = ({ d }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = {
  home: "M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z", tasks: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  prayer: "M12 3a9 9 0 1 0 9 9c0-1-.2-2-.5-3A7 7 0 0 1 12 3z", study: "M4 19a2 2 0 0 0 2 2h14V3H6a2 2 0 0 0-2 2zM4 17h16", health: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  family: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", shop: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

export default function Layout() {
  const { user, lang, isParent, unread, logout } = useAuth();
  const nav = isParent
    ? [["/", "home"], ["/prayer", "prayer"], ["/health", "health"], ["/family", "family"], ...(user.role === "admin" ? [["/shop", "shop"]] : []), ["/settings", "settings"]]
    : [["/", "home"], ["/tasks", "tasks"], ["/study", "study"], ["/prayer", "prayer"], ["/health", "health"], ["/family", "family"]];
  return (
    <div dir={dirFor(lang)} className="min-h-screen max-w-md mx-auto bg-ivory relative">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: user.color }}>{user.displayName[0]}</div>
          <div><div className="font-semibold">{user.displayName}</div><div className="text-xs text-muted">{new Date().toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</div></div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <NavLink to="/settings" className="pill pill-gold">{unread}</NavLink>}
          <button onClick={logout} className="text-xs text-muted">{t(lang, "logout")}</button>
        </div>
      </header>
      <main className="px-4 pb-28">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-line">
        <div className="flex justify-around py-2">
          {nav.map(([to, key]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center gap-1 px-2 py-1 text-[11px] ${isActive ? "text-olive font-semibold" : "text-muted"}`}>
              <Icon d={ICONS[key]} /><span>{t(lang, key)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
