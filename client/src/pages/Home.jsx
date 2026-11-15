import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { fam } from "../lib/paths.js";
import { Card, Stat, Spinner } from "../components/ui.jsx";
import TaskList from "../components/TaskList.jsx";
import { DayTrain } from "../components/Journey.jsx";

function ParentHome() {
  const { members, user } = useAuth();
  const { t, list } = useT();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const [plans, setPlans] = useState({});
  const [pending, setPending] = useState([]);
  const [requests, setRequests] = useState([]);
  const load = async () => {
    const out = {};
    for (const k of kids) out[k.id] = await get(`/tasks/plan?u=${k.id}`);
    setPlans(out); setPending(await get("/tasks/pending"));
    get("/journey/rewards").then((d) => setRequests(d.redemptions.filter((r) => r.status === "pending"))).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [members.length]);
  const confirm = async (id) => { await post(`/tasks/completion/${id}/confirm`); load(); };
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div><h1 className="text-2xl lg:text-3xl font-semibold">{t(user.role === "owner" ? "home.greetOwner" : "home.greetAdmin", { name: user.displayName })}</h1><div className="text-sm text-muted">{t("home.familyToday")}</div></div>
      {pending.length > 0 && (
        <Card title={t("home.waitingYou")}>
          <div className="grid md:grid-cols-2 md:gap-x-6">
            {pending.map((c) => (
              <div key={c._id} className="row">
                <div className="min-w-0"><div className="font-semibold text-sm">{c.task?.title}</div><div className="text-xs text-muted">{c.user?.displayName} · <span dir="ltr">{c.day}</span></div></div>
                <button className="btn btn-sm" onClick={() => confirm(c._id)}>{t("common.confirm")} +{c.task?.points}</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {requests.length > 0 && (
        <Link to={fam("/tasks?tab=rewards")} className="card flex items-center justify-between gap-2 hover:border-olive">
          <span className="font-semibold">🎟️ {t("rewards.requestsN", { n: requests.length })}</span><span className="text-sm text-olive">{t("common.open")}</span>
        </Link>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kids.map((k) => {
          const p = plans[k.id];
          return (
            <Card key={k.id} title={<span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: k.color }} />{k.displayName} <span className="text-xs text-muted font-normal" dir="ltr">{k.grade}</span></span>} right={p && <span className="pill pill-gold">+{p.today}</span>}>
              {!p ? <Spinner /> : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3"><Stat label={t("common.balance")} value={p.balance} /><Stat label={t("home.fajrStreak")} value={p.streaks.prayer} /><Stat label={t("common.fun")} value={p.fun.unlocked ? t("common.unlocked") : t("common.locked")} sub={t("common.minutesShort", { n: p.fun.minutes })} /></div>
                  <div className="mb-2"><DayTrain plan={p.plan} fun={p.fun} compact /></div>
                  <div className="text-xs text-muted">{t("home.tasksOf", { done: p.plan.filter((x) => x.status === "done").length, total: p.plan.length })}{p.fun.pending.length ? ` · ${t("home.left")} ${list(p.fun.pending)}` : ""}</div>
                  <div className="flex flex-wrap gap-2 mt-3"><Link to={fam(`/tasks?u=${k.id}`)} className="btn btn-sm">{t("nav.tasksP")}</Link><Link to={fam(`/health?u=${k.id}`)} className="btn-ghost btn-sm">{t("nav.health")}</Link><Link to={fam(`/study?u=${k.id}`)} className="btn-ghost btn-sm">{t("nav.study")}</Link><Link to={fam(`/prayer?u=${k.id}`)} className="btn-ghost btn-sm">{t("nav.prayer")}</Link></div>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ChildHome() {
  const { user } = useAuth();
  const { t, list } = useT();
  const [p, setP] = useState(null);
  const load = () => get("/tasks/plan").then(setP);
  useEffect(() => { load(); }, []);
  if (!p) return <Spinner />;
  const mandatory = p.plan.filter((x) => x.mandatory), doneM = mandatory.filter((x) => x.status === "done").length;
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div><h1 className="text-2xl lg:text-3xl font-semibold">{t("home.hi", { name: user.displayName })}</h1><div className="text-sm text-muted">{t("home.todayBalance", { today: p.today, balance: p.balance })}</div></div>
      <Link to={fam("/tasks")} className="block hover:opacity-95" aria-label={t("journey.openJourney")}><DayTrain plan={p.plan} fun={p.fun} /></Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <Card className="lg:sticky lg:top-8">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{t("home.funTime")}</div><span className={`pill ${p.fun.unlocked ? "pill-green" : ""}`}>{p.fun.unlocked ? t("home.funUnlocked", { n: p.fun.minutes }) : t("home.mustDoOf", { done: doneM, total: mandatory.length })}</span></div>
          <div className="h-2 bg-ivory rounded-full mt-3 overflow-hidden"><div className="h-full bg-olive rounded-full transition-all" style={{ width: `${mandatory.length ? (100 * doneM) / mandatory.length : 0}%` }} /></div>
          {!p.fun.unlocked && p.fun.pending.length > 0 && <div className="text-xs text-muted mt-2">{t("home.left")} {list(p.fun.pending)}</div>}
        </Card>
        <div>
          <div className="section mt-0">{t("home.todayPlan")}</div>
          <TaskList plan={p.plan} onChange={load} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isParent } = useAuth();
  return isParent ? <ParentHome /> : <ChildHome />;
}
