// برامجي (للأب والأم، خاصة بكل شخص): الأعمال، المال، القرارات
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post, patch, del } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Card, Empty, Spinner, PageTitle, Stat, Msg } from "../components/ui.jsx";

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Amman" });
const money = (n, locale) => Number(n || 0).toLocaleString(locale, { maximumFractionDigits: 2 });

function Work() {
  const { t } = useT();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ title: "", due: "", priority: "normal" });
  const [show, setShow] = useState("open");
  const load = () => get("/programs/work").then(setList);
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); if (!f.title.trim()) return; await post("/programs/work", f); setF({ title: "", due: "", priority: "normal" }); load(); };
  const set = async (w, data) => { await patch(`/programs/work/${w._id}`, data); load(); };
  const remove = async (w) => { if (window.confirm(t("tasks.confirmDelete", { title: w.title }))) { await del(`/programs/work/${w._id}`); load(); } };
  if (!list) return <Spinner />;
  const shown = list.filter((w) => (show === "open" ? w.status !== "done" : w.status === "done"));
  const today = todayStr();
  const NEXT = { todo: "doing", doing: "done", done: "todo" };
  return (
    <Card title={`💼 ${t("prog.work")}`} right={<div className="flex gap-1">{["open", "done"].map((k) => <button key={k} className={`pill ${show === k ? "bg-olive text-white border-transparent" : ""}`} onClick={() => setShow(k)}>{t(`prog.show.${k}`)}</button>)}</div>}>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-3">
        <input className="flex-1" placeholder={t("prog.workPh")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
        <div className="flex gap-2">
          <input type="date" className="flex-1 sm:w-40" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} aria-label={t("prog.due")} dir="ltr" />
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} aria-label={t("prog.priority")}>{["high", "normal", "low"].map((p) => <option key={p} value={p}>{t(`prog.pr.${p}`)}</option>)}</select>
          <button className="btn">{t("common.add")}</button>
        </div>
      </form>
      {shown.length === 0 && <Empty text={t("common.nothingYet")} />}
      {shown.map((w) => {
        const late = w.status !== "done" && w.due && w.due < today;
        return (
          <div key={w._id} className="row">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs ${w.status === "done" ? "bg-olive border-olive text-white" : w.status === "doing" ? "border-gold bg-[#F6E8D2]" : "border-line"}`} onClick={() => set(w, { status: NEXT[w.status] })} aria-label={t(`prog.st.${w.status}`)} title={t(`prog.st.${w.status}`)}>{w.status === "done" ? "✓" : w.status === "doing" ? "…" : ""}</button>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${w.status === "done" ? "line-through text-muted" : ""}`} dir="auto">{w.priority === "high" && "🔴 "}{w.title}</div>
                <div className={`text-xs ${late ? "text-[#8A3B12] font-semibold" : "text-muted"}`}>{t(`prog.st.${w.status}`)}{w.due ? <> · <span dir="ltr">{w.due}</span>{late ? ` · ${t("prog.late")}` : ""}</> : ""}</div>
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => remove(w)} aria-label={t("common.delete")}>🗑</button>
          </div>
        );
      })}
    </Card>
  );
}

const CATS = ["بيت", "أكل", "مدارس", "مواصلات", "فواتير", "صحة", "ملابس", "هدايا", "ترفيه", "صدقة", "أخرى"];
function MoneyBook() {
  const { t, locale } = useT();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [sum, setSum] = useState(null);
  const [list, setList] = useState([]);
  const [f, setF] = useState({ kind: "expense", amount: "", category: "بيت", note: "", day: todayStr() });
  const load = () => { get(`/programs/summary?month=${month}`).then(setSum); get(`/programs/money?month=${month}`).then(setList); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);
  const add = async (e) => { e.preventDefault(); if (!(+f.amount > 0)) return; await post("/programs/money", f); setF({ ...f, amount: "", note: "" }); load(); };
  const remove = async (m) => { await del(`/programs/money/${m._id}`); load(); };
  const max = Math.max(1, ...(sum?.byCat || []).map((c) => c[1]));
  return (
    <Card title={`💰 ${t("prog.money")}`} right={<input type="month" className="h-9" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" aria-label={t("prog.month")} />}>
      {sum && <div className="grid grid-cols-3 gap-2 mb-3"><Stat label={t("prog.income")} value={money(sum.income, locale)} /><Stat label={t("prog.expense")} value={money(sum.expense, locale)} /><Stat label={t("prog.net")} value={money(sum.net, locale)} /></div>}
      <form onSubmit={add} className="flex flex-col gap-2 mb-3">
        <div className="flex gap-2">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label={t("prog.kind")}><option value="expense">{t("prog.expense")}</option><option value="income">{t("prog.income")}</option></select>
          <input className="flex-1" type="number" step="0.01" min="0" inputMode="decimal" placeholder={t("prog.amount")} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label={t("prog.amount")} />
          <input type="date" className="w-36 hidden sm:block" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} dir="ltr" aria-label={t("prog.day")} />
        </div>
        <div className="flex gap-2">
          <input list="money-cats" className="w-32" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label={t("prog.category")} />
          <datalist id="money-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
          <input className="flex-1" placeholder={t("prog.notePh")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} />
          <button className="btn">{t("common.add")}</button>
        </div>
      </form>
      {sum?.byCat?.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          <div className="text-xs text-muted">{t("prog.byCat")}</div>
          {sum.byCat.map(([c, v]) => <div key={c} className="flex items-center gap-2 text-xs"><span className="w-16 shrink-0 truncate">{c}</span><div className="flex-1 h-2 bg-ivory rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: `${(100 * v) / max}%` }} /></div><span className="w-16 text-end" dir="ltr">{money(v, locale)}</span></div>)}
        </div>
      )}
      {list.length === 0 && <Empty text={t("common.nothingYet")} />}
      {list.slice(0, 40).map((m) => (
        <div key={m._id} className="row text-sm">
          <span className="min-w-0"><span dir="ltr" className="text-xs text-muted">{m.day.slice(5)}</span> · {m.category || "—"}{m.note ? ` · ${m.note}` : ""}</span>
          <span className="flex items-center gap-2"><b dir="ltr" className={m.kind === "income" ? "text-olive" : "text-[#8A3B12]"}>{m.kind === "income" ? "+" : "−"}{money(m.amount, locale)}</b><button className="text-xs text-muted" onClick={() => remove(m)} aria-label={t("common.delete")}>✕</button></span>
        </div>
      ))}
    </Card>
  );
}

function Decisions({ ai }) {
  const { t } = useT();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ title: "", options: "" });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const load = () => get("/programs/decisions").then(setList);
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); if (!f.title.trim()) return; const d = await post("/programs/decisions", f); setF({ title: "", options: "" }); setOpen(d._id); load(); };
  const save = async (d, data) => { await patch(`/programs/decisions/${d._id}`, data); load(); };
  const think = async (d) => { setBusy(d._id); setErr(""); try { await post(`/programs/decisions/${d._id}/think`); load(); } catch { setErr(t("ai.failed")); } setBusy(""); };
  if (!list) return <Spinner />;
  return (
    <Card title={`🧭 ${t("prog.decisions")}`}>
      <form onSubmit={add} className="flex flex-col gap-2 mb-3">
        <input placeholder={t("prog.decisionPh")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
        <div className="flex gap-2"><input className="flex-1" placeholder={t("prog.optionsPh")} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /><button className="btn">{t("common.add")}</button></div>
      </form>
      {err && <Msg kind="err">{err}</Msg>}
      {list.length === 0 && <Empty text={t("common.nothingYet")} />}
      {list.map((d) => (
        <div key={d._id} className="py-2 border-b border-line last:border-0">
          <button className="w-full flex items-center justify-between gap-2 text-start" onClick={() => setOpen(open === d._id ? null : d._id)} aria-expanded={open === d._id}>
            <span className="font-semibold text-sm min-w-0" dir="auto">{d.title}</span>
            <span className={`pill shrink-0 ${d.status === "decided" ? "pill-green" : d.status === "reviewed" ? "" : "pill-gold"}`}>{t(`prog.dst.${d.status}`)}</span>
          </button>
          {open === d._id && (
            <div className="flex flex-col gap-2 mt-2 text-sm">
              {[["options", "prog.options"], ["choice", "prog.choice"], ["reason", "prog.reason"]].map(([k, l]) => (
                <label key={k} className="flex flex-col gap-1 text-xs text-muted">{t(l)}<textarea className="py-2 text-sm text-ink" rows={2} defaultValue={d[k] || ""} onBlur={(e) => e.target.value !== (d[k] || "") && save(d, { [k]: e.target.value })} /></label>
              ))}
              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex flex-col gap-1 text-xs text-muted">{t("prog.reviewOn")}<input type="date" defaultValue={d.reviewOn || ""} dir="ltr" onChange={(e) => save(d, { reviewOn: e.target.value })} /></label>
                {d.status === "open" && <button className="btn btn-sm" onClick={() => save(d, { status: "decided" })}>{t("prog.markDecided")}</button>}
                {ai && <button className="btn-ghost btn-sm" disabled={busy === d._id} onClick={() => think(d)}>{busy === d._id ? t("ai.working") : `✨ ${t("prog.think")}`}</button>}
                <button className="btn-ghost btn-sm" onClick={async () => { if (window.confirm(t("tasks.confirmDelete", { title: d.title }))) { await del(`/programs/decisions/${d._id}`); load(); } }} aria-label={t("common.delete")}>🗑</button>
              </div>
              {d.status !== "open" && <label className="flex flex-col gap-1 text-xs text-muted">{t("prog.outcome")}<textarea className="py-2 text-sm text-ink" rows={2} defaultValue={d.outcome || ""} onBlur={(e) => e.target.value !== (d.outcome || "") && save(d, { outcome: e.target.value, status: e.target.value ? "reviewed" : d.status })} /></label>}
              {d.ai && (
                <div className="rounded-xl bg-ivory p-3 flex flex-col gap-2">
                  {d.ai.options?.map((o, i) => <div key={i}><div className="font-semibold">{o.option}</div><ul className="text-xs list-disc ms-5">{o.pros.map((x, j) => <li key={`p${j}`} className="text-olive">{x}</li>)}{o.cons.map((x, j) => <li key={`c${j}`} className="text-[#8A3B12]">{x}</li>)}</ul></div>)}
                  {d.ai.questions?.length > 0 && <div><div className="font-semibold text-xs">{t("prog.askYourself")}</div><ul className="text-xs list-disc ms-5">{d.ai.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
                  {d.ai.tip && <div className="text-xs">💡 {d.ai.tip}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

export default function Programs() {
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "work";
  const [sum, setSum] = useState(null);
  useEffect(() => { get("/programs/summary").then(setSum); }, [tab]);
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("nav.programs")}</PageTitle>
      <div className="text-xs text-muted">{t("prog.private")}</div>
      {sum && (sum.overdue > 0 || sum.toReview > 0) && <Msg kind="warn">{[sum.overdue ? t("prog.overdueN", { n: sum.overdue }) : "", sum.toReview ? t("prog.reviewN", { n: sum.toReview }) : ""].filter(Boolean).join(" · ")}</Msg>}
      <div className="flex gap-1 rounded-xl bg-white border border-line p-1 self-start" role="tablist">
        {["work", "money", "decisions"].map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setSp({ tab: k })} className={`px-3 sm:px-4 h-9 rounded-lg text-sm font-semibold ${tab === k ? "bg-olive text-white" : "text-muted"}`}>{t(`prog.${k}`)}</button>)}
      </div>
      <div className="w-full max-w-3xl">
        {tab === "work" && <Work />}
        {tab === "money" && <MoneyBook />}
        {tab === "decisions" && <Decisions ai={sum?.ai} />}
      </div>
    </div>
  );
}
