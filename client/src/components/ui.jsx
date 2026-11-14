export function Card({ title, children, className = "", right }) {
  return (
    <div className={`card ${className}`}>
      {(title || right) && <div className="flex items-center justify-between mb-3"><div className="font-semibold">{title}</div>{right}</div>}
      {children}
    </div>
  );
}
export function Stat({ label, value, sub }) {
  return <div className="bg-ivory rounded-xl p-3 text-center"><div className="text-xl font-bold text-gold">{value}</div><div className="text-xs text-muted">{label}</div>{sub && <div className="text-[11px] text-muted">{sub}</div>}</div>;
}
export function Empty({ text }) { return <div className="text-center text-muted text-sm py-6">{text}</div>; }
export function Spinner() { return <div className="text-center text-muted py-10">…</div>; }
export function Msg({ kind = "ok", children }) {
  const cls = kind === "ok" ? "bg-[#DDEEEA] text-[#165A50]" : kind === "warn" ? "bg-[#F6E8D2] text-[#8A5612]" : "bg-[#FBEDE4] text-[#8A3B12]";
  return <div className={`rounded-xl px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
export function MemberTabs({ members, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {members.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} className={`pill whitespace-nowrap ${String(value) === String(m.id) ? "text-white border-transparent" : ""}`} style={String(value) === String(m.id) ? { background: m.color } : {}}>{m.displayName}</button>
      ))}
    </div>
  );
}
