import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Stat, Msg, Spinner } from "../components/ui.jsx";
import TaskList from "../components/TaskList.jsx";

function ParentHome() {
  const { members, user } = useAuth();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const [plans, setPlans] = useState({});
  const [pending, setPending] = useState([]);
  const load = async () => {
    const out = {};
    for (const k of kids) out[k.id] = await get(`/tasks/plan?u=${k.id}`);
    setPlans(out); setPending(await get("/tasks/pending"));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [members.length]);
  const confirm = async (id) => { await post(`/tasks/completion/${id}/confirm`); load(); };
  return (
    <div className="flex flex-col gap-4">
      <div><div className="text-2xl font-semibold">{user.role === "owner" ? "صباح الخير يا قاسم" : "أهلاً رنا"}</div><div className="text-sm text-muted">العائلة اليوم</div></div>
      {pending.length > 0 && (
        <Card title="بانتظار تأكيدك">
          {pending.map((c) => (
            <div key={c._id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
              <div><div className="font-semibold text-sm">{c.task?.title}</div><div className="text-xs text-muted">{c.user?.displayName} · {c.day}</div></div>
              <button className="btn btn-sm" onClick={() => confirm(c._id)}>تأكيد +{c.task?.points}</button>
            </div>
          ))}
        </Card>
      )}
      {kids.map((k) => {
        const p = plans[k.id];
        return (
          <Card key={k.id} title={<span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: k.color }} />{k.displayName} <span className="text-xs text-muted font-normal">{k.grade}</span></span>} right={p && <span className="pill pill-gold">+{p.today}</span>}>
            {!p ? <Spinner /> : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3"><Stat label="الرصيد" value={p.balance} /><Stat label="فجر متتالي" value={p.streaks.prayer} /><Stat label="الترفيه" value={p.fun.unlocked ? "مفتوح" : "مقفل"} sub={`${p.fun.minutes} د`} /></div>
                <div className="text-xs text-muted">{p.plan.filter((t) => t.status === "done").length} من {p.plan.length} مهام{p.fun.pending.length ? ` · باقي: ${p.fun.pending.join("، ")}` : ""}</div>
                <div className="flex gap-2 mt-3"><Link to={`/health?u=${k.id}`} className="btn-ghost btn-sm">الصحة</Link><Link to={`/study?u=${k.id}`} className="btn-ghost btn-sm">الدراسة</Link><Link to={`/prayer?u=${k.id}`} className="btn-ghost btn-sm">الصلاة</Link></div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ChildHome() {
  const { user, lang } = useAuth();
  const [p, setP] = useState(null);
  const load = () => get("/tasks/plan").then(setP);
  useEffect(() => { load(); }, []);
  if (!p) return <Spinner />;
  const en = lang !== "ar";
  const mandatory = p.plan.filter((t) => t.mandatory), doneM = mandatory.filter((t) => t.status === "done").length;
  return (
    <div className="flex flex-col gap-4">
      <div><div className="text-2xl font-semibold">{en ? `Hi ${user.displayName}` : `أهلاً ${user.displayName}`}</div><div className="text-sm text-muted">{en ? `Today +${p.today} · balance ${p.balance}` : `اليوم +${p.today} · الرصيد ${p.balance}`}</div></div>
      <Card>
        <div className="flex items-center justify-between"><div className="font-semibold">{en ? "Fun time" : "وقت الترفيه"}</div><span className={`pill ${p.fun.unlocked ? "pill-green" : ""}`}>{p.fun.unlocked ? (en ? `Unlocked · ${p.fun.minutes} min` : `مفتوح · ${p.fun.minutes} دقيقة`) : (en ? `${doneM}/${mandatory.length} must-do` : `${doneM} من ${mandatory.length} إلزامي`)}</span></div>
        <div className="h-2 bg-ivory rounded-full mt-3 overflow-hidden"><div className="h-full bg-olive rounded-full transition-all" style={{ width: `${mandatory.length ? (100 * doneM) / mandatory.length : 0}%` }} /></div>
        {!p.fun.unlocked && p.fun.pending.length > 0 && <div className="text-xs text-muted mt-2">{en ? "Left: " : "باقي: "}{p.fun.pending.join("، ")}</div>}
      </Card>
      <div className="section">{en ? "Today's plan" : "خطة اليوم"}</div>
      <TaskList plan={p.plan} onChange={load} lang={lang} />
    </div>
  );
}

export default function Home() {
  const { isParent } = useAuth();
  return isParent ? <ParentHome /> : <ChildHome />;
}
