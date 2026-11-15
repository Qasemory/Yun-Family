import { useEffect, useState } from "react";
import { get } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import TaskList from "../components/TaskList.jsx";
import { Card, Empty, PageTitle, Spinner } from "../components/ui.jsx";

export default function Tasks() {
  const { t } = useT();
  const [p, setP] = useState(null);
  const [ledger, setLedger] = useState([]);
  const load = () => { get("/tasks/plan").then(setP); get("/tasks/ledger").then(setLedger); };
  useEffect(() => { load(); }, []);
  if (!p) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("nav.tasks")}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <TaskList plan={p.plan} onChange={load} />
        <Card title={t("tasks.pointsLog")} className="lg:sticky lg:top-8">
          {ledger.length === 0 && <Empty text={t("common.nothingYet")} />}
          {ledger.slice(0, 20).map((l) => <div key={l._id} className="flex justify-between gap-3 text-sm py-1.5 border-b border-line last:border-0"><span className="min-w-0">{l.reason}</span><span dir="ltr" className={`shrink-0 ${l.delta > 0 ? "text-olive font-semibold" : "text-[#8A3B12]"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}
        </Card>
      </div>
    </div>
  );
}
