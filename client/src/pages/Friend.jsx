// صديقي: محادثة آمنة للأولاد. الأهل بيشوفوا المحادثة (للقراءة فقط).
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Spinner, PageTitle, MemberTabs, Msg, Empty } from "../components/ui.jsx";

export default function Friend() {
  const { user, members, isParent } = useAuth();
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const u = isParent ? (sp.get("u") || kids[0]?.id) : user.id;
  const [d, setD] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef(null);
  const load = () => get(`/friend${isParent ? `?u=${u}` : ""}`).then(setD).catch(() => setD({ messages: [], ai: false, left: 0 }));
  useEffect(() => { setD(null); if (u) load(); /* eslint-disable-next-line */ }, [u]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [d?.messages?.length, busy]);
  const send = async (e) => {
    e.preventDefault(); const msg = text.trim(); if (!msg || busy) return;
    setBusy(true); setErr(""); setText("");
    setD((x) => ({ ...x, messages: [...x.messages, { _id: `tmp-${Date.now()}`, from: "kid", text: msg }] }));
    try { const r = await post("/friend", { text: msg }); setD((x) => ({ ...x, left: Math.max(0, x.left - 1), messages: [...x.messages, r.message] })); }
    catch (ex) { setErr(t(ex.message === "friend_limit" ? "friend.limit" : ex.message === "ai_off" ? "friend.off" : "ai.failed")); load(); }
    setBusy(false);
  };
  if (isParent && !kids.length) return <Empty text={t("tasks.noKids")} />;
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
      <PageTitle right={!isParent && d && <span className="pill">{t("friend.left", { n: d.left })}</span>}>💬 {t("nav.friend")}</PageTitle>
      {isParent && <MemberTabs members={kids} value={u} onChange={(id) => setSp({ u: id })} />}
      <div className="text-xs text-muted">{isParent ? t("friend.parentNote") : t("friend.kidNote")}</div>
      {!d ? <Spinner /> : (
        <>
          {!d.ai && <Msg kind="warn">{t("friend.off")}</Msg>}
          <div className="card flex flex-col gap-2 min-h-[50vh] max-h-[65vh] overflow-y-auto" aria-live="polite">
            {d.messages.length === 0 && <Empty text={isParent ? t("friend.emptyParent") : t("friend.empty")} />}
            {d.messages.map((m) => (
              <div key={m._id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed ${m.from === "kid" ? "self-start bg-olive text-white rounded-es-sm" : "self-end bg-ivory border border-line rounded-ee-sm"}`} dir="auto">
                {m.from === "friend" && <span aria-hidden="true">🤖 </span>}{m.text}
                {isParent && m.concern && m.concern !== "none" && <div className={`text-[11px] mt-1 ${m.concern === "high" ? "text-[#FBEDE4] font-semibold" : "opacity-80"}`}>⚠ {t(`friend.concern.${m.concern}`)}</div>}
              </div>
            ))}
            {busy && <div className="self-end text-muted text-sm px-3">🤖 …</div>}
            <div ref={end} />
          </div>
          {err && <Msg kind="err">{err}</Msg>}
          {!isParent && d.ai && (
            <form onSubmit={send} className="flex gap-2 sticky bottom-24 lg:bottom-4">
              <input className="flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("friend.ph")} maxLength={500} aria-label={t("friend.ph")} disabled={d.left <= 0} />
              <button className="btn" disabled={busy || !text.trim() || d.left <= 0}>{t("friend.send")}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
