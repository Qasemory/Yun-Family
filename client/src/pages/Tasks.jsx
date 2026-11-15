import { useEffect, useState } from "react";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import TaskList from "../components/TaskList.jsx";
import { Card, Empty, PageTitle, Spinner, MemberTabs, Msg } from "../components/ui.jsx";

// الأهل: Claude يقترح مهام مناسبة لعمر الولد، والأهل يختاروا شو يضيفوا
function SuggestTasks() {
  const { members } = useAuth();
  const { t } = useT();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const [u, setU] = useState(kids[0]?.id);
  const [wish, setWish] = useState("");
  const [list, setList] = useState(null);
  const [added, setAdded] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!kids.length) return null;
  const go = async (e) => { e.preventDefault(); setBusy(true); setErr(""); setList(null); setAdded({}); try { setList(await post("/tasks/suggest", { userId: u, wish })); } catch (x) { setErr(x.message === "ai_off" ? t("ai.off") : t("ai.failed")); } setBusy(false); };
  const add = async (s, i) => { await post("/tasks/manage", { userId: u, title: s.title, domainKey: s.domainKey, preferredTime: s.preferredTime, durationMin: s.durationMin, points: s.points }); setAdded({ ...added, [i]: true }); };
  return (
    <Card title={t("tasks.suggest")}>
      <MemberTabs members={kids} value={u} onChange={(id) => { setU(id); setList(null); }} />
      <form onSubmit={go} className="flex flex-col sm:flex-row gap-2 mt-1"><input className="flex-1" placeholder={t("tasks.wishPh")} value={wish} onChange={(e) => setWish(e.target.value)} /><button className="btn" disabled={busy}>{busy ? "…" : t("tasks.suggestBtn")}</button></form>
      {busy && <div className="text-xs text-muted mt-2">{t("ai.working")}</div>}
      {err && <div className="mt-2"><Msg kind="warn">{err}</Msg></div>}
      {list?.map((s, i) => (
        <div key={i} className="row">
          <div className="min-w-0"><div className="font-semibold text-sm">{s.title}</div><div className="text-xs text-muted">{t(`domain.${s.domainKey}`, null, s.domainKey)} · <span dir="ltr">{s.preferredTime}</span> · {t("tasks.min", { n: s.durationMin })} · +{s.points}</div><div className="text-xs text-muted">{s.why}</div></div>
          <button className="btn-ghost btn-sm shrink-0" disabled={added[i]} onClick={() => add(s, i)}>{added[i] ? t("tasks.added") : t("common.add")}</button>
        </div>
      ))}
    </Card>
  );
}

export default function Tasks() {
  const { t } = useT();
  const { isParent } = useAuth();
  const [p, setP] = useState(null);
  const [ledger, setLedger] = useState([]);
  const load = () => { get("/tasks/plan").then(setP); get("/tasks/ledger").then(setLedger); };
  useEffect(() => { load(); }, []);
  if (!p) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("nav.tasks")}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4 min-w-0"><TaskList plan={p.plan} onChange={load} />{isParent && <SuggestTasks />}</div>
        <Card title={t("tasks.pointsLog")} className="lg:sticky lg:top-8">
          {ledger.length === 0 && <Empty text={t("common.nothingYet")} />}
          {ledger.slice(0, 20).map((l) => <div key={l._id} className="flex justify-between gap-3 text-sm py-1.5 border-b border-line last:border-0"><span className="min-w-0">{l.reason}</span><span dir="ltr" className={`shrink-0 ${l.delta > 0 ? "text-olive font-semibold" : "text-[#8A3B12]"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}
        </Card>
      </div>
    </div>
  );
}
