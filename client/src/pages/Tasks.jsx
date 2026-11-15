// صفحة المهام: للولد (القطار + المهام + المكافآت + الشارات) وللأهل (إدارة كاملة لكل ولد)
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post, patch, del, imgSrc } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Empty, Spinner, PageTitle, MemberTabs, Msg } from "../components/ui.jsx";
import TaskList from "../components/TaskList.jsx";
import { DayTrain, WeekStars, Badges, FamilyTrain, RewardShop, DOMAIN_ICON } from "../components/Journey.jsx";

const DOMAINS = ["prayer", "study", "quran", "dhikr", "sport", "language", "hobby", "health", "home"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function Ledger({ u }) {
  const { t } = useT();
  const [ledger, setLedger] = useState([]);
  useEffect(() => { get(`/tasks/ledger${u ? `?u=${u}` : ""}`).then(setLedger).catch(() => setLedger([])); }, [u]);
  return (
    <Card title={t("tasks.pointsLog")}>
      {ledger.length === 0 && <Empty text={t("common.nothingYet")} />}
      {ledger.slice(0, 20).map((l) => <div key={l._id} className="flex justify-between gap-3 text-sm py-1.5 border-b border-line last:border-0"><span className="min-w-0" dir="auto">{l.reason}</span><span dir="ltr" className={`shrink-0 ${l.delta > 0 ? "text-olive font-semibold" : "text-[#8A3B12]"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}
    </Card>
  );
}

// ---------------- الولد ----------------
function KidTasks() {
  const { t } = useT();
  const [j, setJ] = useState(null);
  const [rw, setRw] = useState(null);
  const [tick, setTick] = useState(0);
  const load = () => { get("/journey").then(setJ); get("/journey/rewards").then(setRw); setTick((x) => x + 1); };
  useEffect(() => { load(); }, []);
  if (!j) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle right={<span className="pill pill-gold">{t("common.balance")}: {j.balance}</span>}>{t("nav.tasks")}</PageTitle>
      {j.freshBadges?.length > 0 && <Msg kind="ok">{t("journey.newBadge")}</Msg>}
      <DayTrain plan={j.plan} fun={j.fun} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <TaskList plan={j.plan} onChange={load} />
          <RewardShop data={rw} onChange={load} />
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <WeekStars week={j.week} streak={j.streak} graceLeft={j.graceLeft} />
          <FamilyTrain family={j.family} />
        </div>
      </div>
      <Badges badges={j.badges} fresh={j.freshBadges} />
      <Ledger key={tick} />
    </div>
  );
}

// ---------------- الأهل ----------------
const EMPTY = { title: "", domainKey: "home", preferredTime: "", durationMin: 15, points: 5, days: ALL_DAYS, mandatory: false, needsProof: false, needsParentConfirm: false };

function TaskForm({ initial, onSave, onCancel }) {
  const { t, locale } = useT();
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggleDay = (d) => set("days", f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort());
  const dayName = (d) => new Date(Date.UTC(2026, 10, 15 + d, 12)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }); // 15/11/2026 = أحد
  const submit = async (e) => {
    e.preventDefault(); if (!f.title.trim()) return;
    if (!f.days.length) { setErr(t("tasks.pickDay")); return; }
    setBusy(true); setErr("");
    try { await onSave(f); } catch { setErr(t("common.notSaved")); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="flex-1" placeholder={t("tasks.titlePh")} aria-label={t("tasks.titleLabel")} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={80} autoFocus />
        <select value={f.domainKey} onChange={(e) => set("domainKey", e.target.value)} aria-label={t("tasks.domain")}>{DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_ICON[d]} {t(`domain.${d}`, null, d)}</option>)}</select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted flex flex-col gap-1">{t("tasks.time")}<input type="time" value={f.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} dir="ltr" /></label>
        <label className="text-xs text-muted flex flex-col gap-1">{t("tasks.duration")}<input type="number" inputMode="numeric" min="0" max="240" value={f.durationMin} onChange={(e) => set("durationMin", e.target.value)} /></label>
        <label className="text-xs text-muted flex flex-col gap-1">{t("tasks.points")}<input type="number" inputMode="numeric" min="1" max="100" value={f.points} onChange={(e) => set("points", e.target.value)} /></label>
      </div>
      <div>
        <div className="text-xs text-muted mb-1">{t("tasks.days")}</div>
        <div className="flex flex-wrap gap-1">{ALL_DAYS.map((d) => <button type="button" key={d} onClick={() => toggleDay(d)} aria-pressed={f.days.includes(d)} className={`pill ${f.days.includes(d) ? "bg-olive text-white border-transparent" : ""}`}>{dayName(d)}</button>)}</div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {[["mandatory", "tasks.optMandatory"], ["needsParentConfirm", "tasks.optConfirm"], ["needsProof", "tasks.optProof"]].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} />{t(l)}</label>
        ))}
      </div>
      {err && <Msg kind="err">{err}</Msg>}
      <div className="flex gap-2"><button className="btn" disabled={busy || !f.title.trim()}>{busy ? "…" : t("common.save")}</button>{onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>}</div>
    </form>
  );
}

function ManageTasks({ kid, onChange }) {
  const { t, list } = useT();
  const [tasks, setTasks] = useState(null);
  const [edit, setEdit] = useState(null); // null | "new" | task
  const load = () => get(`/tasks/manage?u=${kid.id}`).then(setTasks);
  useEffect(() => { load(); setEdit(null); /* eslint-disable-next-line */ }, [kid.id]);
  const done = () => { setEdit(null); load(); onChange?.(); };
  const save = async (f) => { if (edit === "new") await post("/tasks/manage", { ...f, userId: kid.id }); else await patch(`/tasks/manage/${edit._id}`, f); done(); };
  const toggle = async (task) => { await patch(`/tasks/manage/${task._id}`, { active: !task.active }); load(); onChange?.(); };
  const remove = async (task) => { if (!window.confirm(t("tasks.confirmDelete", { title: task.title }))) return; await del(`/tasks/manage/${task._id}`); load(); onChange?.(); };
  const dayNames = (days) => days?.length === 7 ? t("tasks.everyDay") : list((days || []).map((d) => t(`day.${d}`)));
  return (
    <Card title={t("tasks.manageOf", { name: kid.displayName })} right={edit !== "new" && <button className="btn btn-sm" onClick={() => setEdit("new")}>+ {t("tasks.new")}</button>}>
      {edit === "new" && <div className="mb-4 rounded-xl border border-olive/40 p-3"><TaskForm onSave={save} onCancel={() => setEdit(null)} /></div>}
      {!tasks ? <Spinner /> : tasks.length === 0 ? <Empty text={t("tasks.noneYet")} /> : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <li key={task._id} className="py-2 border-b border-line last:border-0">
              {edit?._id === task._id ? <div className="rounded-xl border border-olive/40 p-3"><TaskForm initial={task} onSave={save} onCancel={() => setEdit(null)} /></div> : (
                <div className={`flex flex-wrap items-center gap-2 ${task.active ? "" : "opacity-55"}`}>
                  <span className="text-xl w-7 text-center shrink-0" aria-hidden="true">{DOMAIN_ICON[task.domainKey] || "•"}</span>
                  <div className="flex-1 min-w-[10rem]">
                    <div className="font-semibold text-[15px]" dir="auto">{task.title}</div>
                    <div className="text-xs text-muted">
                      {task.preferredTime && <span dir="ltr">{task.preferredTime}</span>}{task.preferredTime ? " · " : ""}{t("common.minutesShort", { n: task.durationMin })} · +{task.points} · {dayNames(task.days)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {!task.active && <span className="pill">{t("tasks.paused")}</span>}
                      {task.mandatory && <span className="pill pill-gold">🚩 {t("tasks.mandatory")}</span>}
                      {task.needsParentConfirm && <span className="pill">✋ {t("tasks.badgeConfirm")}</span>}
                      {task.needsProof && <span className="pill">📷 {t("tasks.badgeProof")}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="btn-ghost btn-sm" onClick={() => setEdit(task)}>{t("common.edit")}</button>
                    <button className="btn-ghost btn-sm" onClick={() => toggle(task)}>{task.active ? t("tasks.pause") : t("tasks.resume")}</button>
                    <button className="btn-ghost btn-sm text-[#8A3B12]" onClick={() => remove(task)} aria-label={t("common.delete")}>🗑</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TodayFor({ kid, tick, onChange }) {
  const { t } = useT();
  const [j, setJ] = useState(null);
  const [pending, setPending] = useState([]);
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const load = async () => { setJ(await get(`/journey?u=${kid.id}`)); setPending((await get("/tasks/pending")).filter((c) => String(c.user?._id) === String(kid.id))); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kid.id, tick]);
  if (!j) return <Spinner />;
  const confirm = async (c) => { await post(`/tasks/completion/${c._id}/confirm`); load(); onChange?.(); };
  const doReject = async (e) => { e.preventDefault(); await post(`/tasks/completion/${reject}/reject`, { note }); setReject(null); setNote(""); load(); onChange?.(); };
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <DayTrain plan={j.plan} fun={j.fun} />
      {pending.length > 0 && (
        <Card title={t("home.waitingYou")}>
          {pending.map((c) => (
            <div key={c._id} className="py-2 border-b border-line last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold text-sm" dir="auto">{c.task?.title}</div><div className="text-xs text-muted" dir="ltr">{c.day}</div></div>
                <div className="flex gap-1">
                  <button className="btn btn-sm" onClick={() => confirm(c)}>{t("common.confirm")} +{c.task?.points}</button>
                  <button className="btn-ghost btn-sm" onClick={() => { setReject(c._id); setNote(""); }}>{t("tasks.reject")}</button>
                </div>
              </div>
              {c.proofUrl && <a href={imgSrc(c.proofUrl)} target="_blank" rel="noreferrer"><img src={imgSrc(c.proofUrl)} alt={t("tasks.proof")} className="mt-2 w-28 h-28 object-cover rounded-lg border border-line" loading="lazy" /></a>}
              {reject === c._id && (
                <form onSubmit={doReject} className="flex flex-col sm:flex-row gap-2 mt-2">
                  <input className="flex-1" placeholder={t("tasks.rejectPh")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} autoFocus />
                  <button className="btn btn-sm">{t("tasks.sendBack")}</button>
                </form>
              )}
            </div>
          ))}
        </Card>
      )}
      <WeekStars week={j.week} streak={j.streak} graceLeft={j.graceLeft} />
    </div>
  );
}

function PointsAdjust({ kid, onChange }) {
  const { t } = useT();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  const send = async (sign) => {
    const n = Math.abs(Math.round(+delta || 0));
    if (!n || !reason.trim()) return;
    try { const r = await post("/tasks/points", { userId: kid.id, delta: sign * n, reason }); setMsg({ kind: "ok", text: t("tasks.pointsDone", { n: r.balance }) }); setDelta(""); setReason(""); onChange?.(); }
    catch { setMsg({ kind: "err", text: t("common.notSaved") }); }
  };
  return (
    <Card title={t("tasks.adjust")}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2"><input className="w-24" type="number" inputMode="numeric" min="1" max="500" placeholder="10" aria-label={t("tasks.points")} value={delta} onChange={(e) => setDelta(e.target.value)} /><input className="flex-1" placeholder={t("tasks.reasonPh")} aria-label={t("tasks.reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} /></div>
        <div className="flex gap-2"><button className="btn flex-1" disabled={!delta || !reason.trim()} onClick={() => send(1)}>＋ {t("tasks.bonus")}</button><button className="btn-ghost flex-1" disabled={!delta || !reason.trim()} onClick={() => send(-1)}>－ {t("tasks.deduct")}</button></div>
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      </div>
    </Card>
  );
}

function RewardsAdmin({ tick, onChange }) {
  const { t, locale } = useT();
  const [d, setD] = useState(null);
  const [f, setF] = useState({ icon: "🎁", title: "", cost: 100 });
  const load = () => get("/journey/rewards").then(setD);
  useEffect(() => { load(); }, [tick]);
  if (!d) return <Spinner />;
  const pending = d.redemptions.filter((r) => r.status === "pending");
  const add = async (e) => { e.preventDefault(); if (!f.title.trim()) return; await post("/journey/rewards", f); setF({ icon: "🎁", title: "", cost: 100 }); load(); };
  const decide = async (r, ok) => { await post(`/journey/redemptions/${r._id}/${ok ? "approve" : "reject"}`); load(); onChange?.(); };
  return (
    <Card title={<span>🎟️ {t("rewards.admin")}</span>}>
      {pending.length > 0 && (
        <div className="mb-3 rounded-xl bg-[#FFF7E6] p-3">
          <div className="text-sm font-semibold mb-1">{t("rewards.requests")}</div>
          {pending.map((r) => (
            <div key={r._id} className="row text-sm">
              <span className="min-w-0">{r.icon} <b>{r.user?.displayName}</b>: <span dir="auto">{r.title}</span> · {r.cost}</span>
              <span className="flex gap-1"><button className="btn btn-sm" onClick={() => decide(r, true)}>{t("rewards.approve")}</button><button className="btn-ghost btn-sm" onClick={() => decide(r, false)}>{t("rewards.notNow")}</button></span>
            </div>
          ))}
        </div>
      )}
      {d.rewards.map((rw) => (
        <div key={rw._id} className={`row text-sm ${rw.active ? "" : "opacity-55"}`}>
          <span className="min-w-0">{rw.icon} <span dir="auto">{rw.title}</span></span>
          <span className="flex items-center gap-1">
            <input type="number" className="w-20 h-9" defaultValue={rw.cost} min="1" aria-label={t("rewards.costLabel")} onBlur={async (e) => { if (+e.target.value !== rw.cost) { await patch(`/journey/rewards/${rw._id}`, { cost: +e.target.value }); load(); } }} />
            <button className="btn-ghost btn-sm" onClick={async () => { await patch(`/journey/rewards/${rw._id}`, { active: !rw.active }); load(); }}>{rw.active ? t("tasks.pause") : t("tasks.resume")}</button>
            <button className="btn-ghost btn-sm" aria-label={t("common.delete")} onClick={async () => { if (window.confirm(t("tasks.confirmDelete", { title: rw.title }))) { await del(`/journey/rewards/${rw._id}`); load(); } }}>🗑</button>
          </span>
        </div>
      ))}
      <form onSubmit={add} className="flex flex-wrap gap-2 mt-3">
        <input className="w-16 text-center" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} aria-label={t("rewards.icon")} maxLength={4} />
        <input className="flex-1 min-w-[9rem]" placeholder={t("rewards.titlePh")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={60} />
        <input className="w-24" type="number" min="1" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} aria-label={t("rewards.costLabel")} />
        <button className="btn-ghost">{t("common.add")}</button>
      </form>
      {d.redemptions.filter((r) => r.status !== "pending").length > 0 && (
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">{t("rewards.history")}</summary>
          {d.redemptions.filter((r) => r.status !== "pending").map((r) => <div key={r._id} className="row text-xs"><span>{r.icon} {r.user?.displayName}: <span dir="auto">{r.title}</span> · {new Date(r.createdAt).toLocaleDateString(locale)}</span><span className={`pill ${r.status === "approved" ? "pill-green" : ""}`}>{t(`rewards.st.${r.status}`)}</span></div>)}
        </details>
      )}
    </Card>
  );
}

function FamilyGoal({ tick }) {
  const { t } = useT();
  const [fam, setFam] = useState(null);
  const [f, setF] = useState({ title: "", target: 1000 });
  const [open, setOpen] = useState(false);
  const kidsFirst = useAuth().members.find((m) => ["child", "teen_adult"].includes(m.role));
  useEffect(() => { if (kidsFirst) get(`/journey?u=${kidsFirst.id}`).then((j) => { setFam(j.family); if (j.family.enabled) setF({ title: j.family.title, target: j.family.target }); }); }, [tick, kidsFirst?.id]);
  const save = async (e) => { e.preventDefault(); setFam(await post("/journey/family-goal", f)); setOpen(false); };
  const stop = async () => { setFam(await post("/journey/family-goal", { title: "" })); setOpen(false); };
  const form = open ? (
    <form onSubmit={save} className="flex flex-col sm:flex-row gap-2">
      <input className="flex-1" placeholder={t("journey.goalPh")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
      <input className="w-28" type="number" min="50" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} aria-label={t("journey.goalTarget")} />
      <button className="btn" disabled={!f.title.trim()}>{t("common.save")}</button>
      {fam?.enabled && <button type="button" className="btn-ghost" onClick={stop}>{t("journey.goalStop")}</button>}
    </form>
  ) : <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>{fam?.enabled ? t("common.edit") : t("journey.goalSet")}</button>;
  if (!fam) return null;
  return <FamilyTrain family={fam} onEdit={form} />;
}

function SuggestTasks({ kid, onAdded }) {
  const { t } = useT();
  const [wish, setWish] = useState("");
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState({});
  useEffect(() => { setList(null); setAdded({}); }, [kid.id]);
  const go = async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { setList(await post("/tasks/suggest", { userId: kid.id, wish })); } catch (ex) { setErr(t(ex.message === "ai_off" ? "ai.off" : "ai.failed")); } setBusy(false); };
  const add = async (s, i) => { await post("/tasks/manage", { userId: kid.id, title: s.title, domainKey: s.domainKey, preferredTime: s.preferredTime, durationMin: s.durationMin, points: s.points }); setAdded({ ...added, [i]: true }); onAdded?.(); };
  return (
    <Card title={`✨ ${t("tasks.suggest")}`}>
      <form onSubmit={go} className="flex flex-col sm:flex-row gap-2"><input className="flex-1" placeholder={t("tasks.wishPh")} value={wish} onChange={(e) => setWish(e.target.value)} /><button className="btn" disabled={busy}>{busy ? "…" : t("tasks.suggestBtn")}</button></form>
      {busy && <div className="mt-2"><Msg kind="warn">{t("ai.working")}</Msg></div>}
      {err && <div className="mt-2"><Msg kind="err">{err}</Msg></div>}
      {list?.map((s, i) => (
        <div key={i} className="row">
          <div className="min-w-0"><div className="font-semibold text-sm">{DOMAIN_ICON[s.domainKey]} {s.title}</div><div className="text-xs text-muted">{s.why} · <span dir="ltr">{s.preferredTime}</span> · {t("tasks.min", { n: s.durationMin })} · +{s.points}</div></div>
          <button className="btn-ghost btn-sm shrink-0" disabled={added[i]} onClick={() => add(s, i)}>{added[i] ? t("tasks.added") : t("common.add")}</button>
        </div>
      ))}
    </Card>
  );
}

function ParentTasks() {
  const { members } = useAuth();
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const kid = kids.find((k) => String(k.id) === sp.get("u")) || kids[0];
  const [tab, setTab] = useState(sp.get("tab") || "today");
  const [tick, setTick] = useState(0);
  const bump = () => setTick((x) => x + 1);
  if (!kid) return <Empty text={t("tasks.noKids")} />;
  const TABS = ["today", "manage", "rewards"];
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("nav.tasksP")}</PageTitle>
      <MemberTabs members={kids} value={kid.id} onChange={(id) => setSp({ u: id, tab })} />
      <div className="flex gap-1 rounded-xl bg-white border border-line p-1 self-start" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setSp({ u: kid.id, tab: k }); }} className={`px-3 sm:px-4 h-9 rounded-lg text-sm font-semibold ${tab === k ? "bg-olive text-white" : "text-muted"}`}>{t(`tasks.tab.${k}`)}</button>)}
      </div>
      {tab === "today" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <TodayFor kid={kid} tick={tick} onChange={bump} />
          <div className="flex flex-col gap-4 min-w-0"><PointsAdjust kid={kid} onChange={bump} /><Ledger u={kid.id} key={`${kid.id}-${tick}`} /></div>
        </div>
      )}
      {tab === "manage" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <div className="min-w-0"><ManageTasks key={`${kid.id}-${tick}`} kid={kid} onChange={bump} /></div>
          <div className="min-w-0"><SuggestTasks kid={kid} onAdded={bump} /></div>
        </div>
      )}
      {tab === "rewards" && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0"><RewardsAdmin tick={tick} onChange={bump} /></div>
          <div className="min-w-0"><FamilyGoal tick={tick} /></div>
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { isParent } = useAuth();
  return isParent ? <ParentTasks /> : <KidTasks />;
}
