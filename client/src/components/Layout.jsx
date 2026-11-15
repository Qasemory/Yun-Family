import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useT, useDocumentLang } from "../lib/i18n.js";
import { fam } from "../lib/paths.js";
import { addFamilyManifest } from "../lib/push.js";

const Icon = ({ d, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ICONS = {
  home: "M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z", tasks: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  prayer: "M12 3a9 9 0 1 0 9 9c0-1-.2-2-.5-3A7 7 0 0 1 12 3z", study: "M4 19a2 2 0 0 0 2 2h14V3H6a2 2 0 0 0-2 2zM4 17h16", health: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  family: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", shop: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  friend: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 1 1 21 11.5zM8.5 10h.01M12 10h.01M15.5 10h.01",
  programs: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

function Avatar({ user, size = "w-10 h-10" }) {
  return <div className={`${size} shrink-0 rounded-full flex items-center justify-center text-white font-bold`} style={{ background: user.color }}>{user.displayName[0]}</div>;
}

export default function Layout() {
  const { user, isParent, unread, logout } = useAuth();
  const { t, lang, dir, locale } = useT();
  useDocumentLang(lang, dir, t("appName"));
  // [الرابط، الأيقونة، مفتاح الاسم]
  const items = isParent
    ? [[fam(), "home", "home"], [fam("/tasks"), "tasks", "tasksP"], [fam("/study"), "study", "studyP"], [fam("/feed"), "family", "family"], [fam("/prayer"), "prayer", "prayer"], [fam("/health"), "health", "health"], [fam("/shop"), "shop", "shop"], [fam("/programs"), "programs", "programs"], [fam("/settings"), "settings", "settings"]]
    : [[fam(), "home", "home"], [fam("/tasks"), "tasks", "tasks"], [fam("/study"), "study", "study"], [fam("/friend"), "friend", "friend"], [fam("/prayer"), "prayer", "prayer"], [fam("/health"), "health", "health"], [fam("/feed"), "family", "family"]];
  // الموبايل: ٤ أزرار + «المزيد»
  const MOBILE = 4;
  const bar = items.slice(0, MOBILE), rest = items.slice(MOBILE);
  const loc = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => { addFamilyManifest(); }, []);
  useEffect(() => { setMore(false); }, [loc.pathname]);
  const restActive = rest.some(([to]) => loc.pathname.startsWith(to));
  const today = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div dir={dir} className="min-h-screen bg-ivory lg:flex">
      {/* قائمة جانبية للشاشات الكبيرة */}
      <aside className="hidden lg:flex lg:flex-col w-64 xl:w-72 shrink-0 sticky top-0 h-screen bg-white border-e border-line px-4 py-6">
        <div className="flex items-center gap-3 px-2">
          <Avatar user={user} />
          <div className="min-w-0"><div className="font-semibold truncate">{user.displayName}</div><div className="text-xs text-muted truncate">{today}</div></div>
        </div>
        <nav className="mt-8 flex flex-col gap-1 overflow-y-auto -mx-1 px-1" aria-label={t("mainNav")}>
          {items.map(([to, key, label]) => (
            <NavLink key={to} to={to} end={to === fam()} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${isActive ? "bg-[#DDEEEA] text-olive font-semibold" : "text-ink hover:bg-ivory"}`}>
              <Icon d={ICONS[key]} size={20} /><span className="truncate">{t(`nav.${label}`)}</span>
              {key === "settings" && unread > 0 && <span className="pill pill-gold ms-auto">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-ivory"><Icon d={ICONS.logout} size={20} />{t("logout")}</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* رأس الصفحة للموبايل والتابلت */}
        <header className="lg:hidden sticky top-0 z-20 bg-ivory/95 backdrop-blur border-b border-line/60">
          <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar user={user} />
              <div className="min-w-0"><div className="font-semibold truncate">{user.displayName}</div><div className="text-xs text-muted truncate">{today}</div></div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {unread > 0 && <NavLink to={fam("/settings")} className="pill pill-gold" aria-label={t("notifications")}>{unread}</NavLink>}
              <button onClick={logout} className="text-xs text-muted px-2 py-1">{t("logout")}</button>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-3xl lg:max-w-6xl px-4 sm:px-6 lg:px-10 pt-4 lg:pt-8 pb-28 lg:pb-12">
          <Outlet />
        </main>

        {/* القائمة السفلية للموبايل والتابلت */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label={t("mainNav")}>
          {more && (
            <div id="more-menu" className="border-b border-line bg-white">
              <div className="mx-auto max-w-3xl grid grid-cols-3 sm:grid-cols-4 gap-1 p-2">
                {rest.map(([to, key, label]) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-xs ${isActive ? "bg-[#DDEEEA] text-olive font-semibold" : "text-ink"}`}>
                    <Icon d={ICONS[key]} /><span className="truncate max-w-full">{t(`nav.${label}`)}</span>
                    {key === "settings" && unread > 0 && <span className="pill pill-gold">{unread}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-3xl flex">
            {bar.map(([to, key, label]) => (
              <NavLink key={to} to={to} end={to === fam()} className={({ isActive }) => `flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-[11px] sm:text-xs ${isActive ? "text-olive font-semibold" : "text-muted"}`}>
                <Icon d={ICONS[key]} /><span className="truncate max-w-full">{t(`nav.${label}`)}</span>
              </NavLink>
            ))}
            {rest.length > 0 && (
              <button type="button" onClick={() => setMore(!more)} aria-expanded={more} aria-controls="more-menu" className={`flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 text-[11px] sm:text-xs ${more || restActive ? "text-olive font-semibold" : "text-muted"}`}>
                <Icon d={ICONS.more} /><span className="truncate max-w-full">{t("nav.more")}</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
