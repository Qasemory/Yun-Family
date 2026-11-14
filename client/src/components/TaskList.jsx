import { useState } from "react";
import { post } from "../lib/api.js";
import { Msg } from "./ui.jsx";

const DOMAIN_AR = { study: "دراسة", prayer: "صلاة", quran: "قرآن", dhikr: "أذكار", sport: "رياضة", language: "لغات", hobby: "هواية", health: "صحة", home: "بيت", fun: "ترفيه" };

export default function TaskList({ plan, onChange, lang = "ar" }) {
  const [msg, setMsg] = useState(null);
  const en = lang !== "ar";
  const done = async (t) => {
    let proofUrl;
    if (t.needsProof) { proofUrl = window.prompt(en ? "Paste a photo/voice link as proof" : "الصق رابط صورة أو تسجيل كدليل") || ""; if (!proofUrl) return; }
    try {
      const r = await post(`/tasks/${t._id}/done`, { proofUrl });
      setMsg(r.status === "pending_confirm" ? { kind: "warn", text: en ? "Sent to your parents to confirm." : "انبعتت للأهل للتأكيد." } : { kind: "ok", text: `+${r.points} ${en ? "points" : "نقاط"}` });
      onChange?.();
    } catch (e) { setMsg({ kind: "err", text: e.data?.reason === "needs_proof" ? (en ? "This one needs a photo." : "هذي بدها صورة.") : (en ? "Could not save." : "ما انحفظت.") }); }
  };
  return (
    <div className="flex flex-col gap-2">
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      {plan.map((t) => (
        <div key={t._id} className={`card flex items-center gap-3 ${t.status === "done" ? "opacity-70" : ""}`}>
          <div className="w-12 text-center text-xs text-muted">{t.preferredTime}</div>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-[15px] ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
            <div className="text-xs text-muted">{DOMAIN_AR[t.domainKey] || t.domainKey}{t.mandatory ? (en ? " · must-do" : " · إلزامي") : ""}{t.durationMin ? ` · ${t.durationMin} د` : ""}</div>
          </div>
          {t.status === "done" ? <span className="pill pill-green">+{t.points}</span>
            : t.status === "pending_confirm" ? <span className="pill pill-gold">{en ? "waiting" : "بانتظار"}</span>
            : <button className="btn btn-sm" onClick={() => done(t)}>{en ? "Done" : "خلصت"} +{t.points}</button>}
        </div>
      ))}
    </div>
  );
}
