import { useRef, useState } from "react";
import { post } from "../lib/api.js";
import { shrinkImage } from "../lib/image.js";
import { useT } from "../lib/i18n.js";
import { Msg } from "./ui.jsx";

export default function TaskList({ plan, onChange }) {
  const { t } = useT();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const proofFor = useRef(null);
  const send = async (task, proofImage) => {
    setBusy(task._id); setMsg(null);
    try {
      const r = await post(`/tasks/${task._id}/done`, proofImage ? { proofImage } : {});
      const badge = r.badges?.length ? ` ${t("journey.newBadge")}` : "";
      setMsg(r.status === "pending_confirm" ? { kind: "warn", text: t("tasks.sentToParents") } : { kind: "ok", text: t("tasks.gotPoints", { n: r.points }) + badge });
      onChange?.();
    } catch (e) { setMsg({ kind: "err", text: e.data?.reason === "needs_proof" ? t("tasks.needsProof") : e.message === "bad_image" ? t("common.badImage") : t("common.notSaved") }); }
    setBusy("");
  };
  const done = (task) => {
    if (task.needsProof) { proofFor.current = task; fileRef.current?.click(); return; }
    send(task);
  };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    const task = proofFor.current; if (!f || !task) return;
    try { send(task, await shrinkImage(f, 1280, 0.8)); } catch { setMsg({ kind: "err", text: t("common.badImage") }); }
  };
  return (
    <div className="flex flex-col gap-2">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
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
              : <button className="btn btn-sm" disabled={busy === task._id} onClick={() => done(task)}>{busy === task._id ? "…" : <>{task.needsProof ? "📷 " : ""}{t("tasks.markDone")} +{task.points}</>}</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
