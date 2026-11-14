import { useEffect, useState } from "react";
import { get } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import TaskList from "../components/TaskList.jsx";
import { Card, Spinner } from "../components/ui.jsx";

export default function Tasks() {
  const { lang } = useAuth();
  const [p, setP] = useState(null);
  const [ledger, setLedger] = useState([]);
  const load = () => { get("/tasks/plan").then(setP); get("/tasks/ledger").then(setLedger); };
  useEffect(() => { load(); }, []);
  if (!p) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <TaskList plan={p.plan} onChange={load} lang={lang} />
      <Card title={lang === "ar" ? "سجل النقاط" : "Points log"}>
        {ledger.slice(0, 20).map((l) => <div key={l._id} className="flex justify-between text-sm py-1 border-b border-line last:border-0"><span>{l.reason}</span><span className={l.delta > 0 ? "text-olive font-semibold" : "text-[#8A3B12]"}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}
      </Card>
    </div>
  );
}
