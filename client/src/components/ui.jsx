import { useState } from "react";
import { useT } from "../lib/i18n.js";

export function Card({ title, children, className = "", right }) {
  return (
    <div className={`card ${className}`}>
      {(title || right) && <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div className="font-semibold min-w-0">{title}</div>{right}</div>}
      {children}
    </div>
  );
}
export function PageTitle({ children, right }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl sm:text-2xl font-semibold min-w-0">{children}</h1>{right}</div>;
}
export function Stat({ label, value, sub }) {
  return <div className="bg-ivory border border-line/70 rounded-xl px-1.5 py-3 text-center min-w-0 [overflow-wrap:normal]"><div className="text-lg font-bold text-gold whitespace-nowrap truncate">{value}</div><div className="text-xs text-muted">{label}</div>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>;
}
export function Empty({ text }) { return <div className="text-center text-muted text-sm py-6">{text}</div>; }
export function Spinner() { return <div className="text-center text-muted py-10" role="status" aria-live="polite">…</div>; }
export function Msg({ kind = "ok", children }) {
  const cls = kind === "ok" ? "bg-[#DDEEEA] text-[#165A50]" : kind === "warn" ? "bg-[#F6E8D2] text-[#8A5612]" : "bg-[#FBEDE4] text-[#8A3B12]";
  return <div className={`rounded-xl px-3 py-2 text-sm ${cls}`} role={kind === "err" ? "alert" : "status"}>{children}</div>;
}
export function MemberTabs({ members, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {members.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} className={`pill whitespace-nowrap ${String(value) === String(m.id) ? "text-white border-transparent" : ""}`} style={String(value) === String(m.id) ? { background: m.color } : {}}>{m.displayName}</button>
      ))}
    </div>
  );
}

/** خانة كلمة سر مع زر إظهار/إخفاء */
export function PasswordInput({ value, onChange, id, autoComplete = "current-password", placeholder, className = "", ...rest }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input id={id} type={show ? "text" : "password"} dir="ltr" autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={onChange} className="w-full pe-16" {...rest} />
      <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 end-0 px-3 text-xs text-muted" aria-label={show ? t("pw.hide") : t("pw.show")}>{show ? t("pw.hide") : t("pw.show")}</button>
    </div>
  );
}

/** قوة كلمة السر: 0..4 */
export function passwordScore(p = "") {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5;
  return Math.min(4, Math.floor(s));
}
export function StrengthMeter({ value }) {
  const { t } = useT();
  if (!value) return null;
  const s = value.length < 8 ? 0 : Math.max(1, passwordScore(value));
  const label = [t("pw.tooShort"), t("pw.weak"), t("pw.ok"), t("pw.good"), t("pw.strong")][s];
  const color = ["#8A3B12", "#B8761A", "#B8761A", "#1F7A6D", "#165A50"][s];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex-1 grid grid-cols-4 gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className="h-1.5 rounded-full" style={{ background: i <= s ? color : "#E6E2DA" }} />)}</div>
      <span className="text-xs" style={{ color }}>{label}</span>
    </div>
  );
}
