import { useState } from "react";
import { post } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Msg } from "./ui.jsx";

export default function TaskList({ plan, onChange }) {
  const { t } = useT();
  const [msg, setMsg] = useState(null);
  const done = async (task) => {
    let proofUrl;
    if (task.needsProof) { proofUrl = window.prompt(t("tasks.proofPrompt")) || ""; if (!proofUrl) return; }
    try {
      const r = await post(`/tasks/${task._id}/done`, { proofUrl });
      setMsg(r.status === "pending_confirm" ? { kind: "warn", text: t("tasks.sentToParents") } : { kind: "ok", text: t("tasks.gotPoints", { n: r.points }) });
      onChange?.();
    } catch (e) { setMsg({ kind: "err", text: e.data?.reason === "needs_proof" ? t("tasks.needsProof") : t("common.notSaved") }); }
  };
  return (
    <div className="flex flex-col gap-2">
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      {plan.map((task) => (
        <div key={task._id} className={`card flex items-center gap-3 ${task.status === "done" ? "opacity-70" : ""}`}>
          <div className="w-12 shrink-0 text-center text-xs text-muted" dir="ltr">{task.preferredTime}</div>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-[15px] ${task.status === "done" ? "line-through" : ""}`}>{task.title}</div>
            <div className="text-xs text-muted">{t(`domain.${task.domainKey}`, null, task.domainKey)}{task.mandatory ? ` · ${t("tasks.mandatory")}` : ""}{task.durationMin ? ` · ${t("common.minutesShort", { n: task.durationMin })}` : ""}</div>
          </div>
          <div className="shrink-0">
            {task.status === "done" ? <span className="pill pill-green">+{task.points}</span>
              : task.status === "pending_confirm" ? <span className="pill pill-gold">{t("common.waiting")}</span>
              : <button className="btn btn-sm" onClick={() => done(task)}>{t("tasks.markDone")} +{task.points}</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
