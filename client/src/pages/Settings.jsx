import { useEffect, useState } from "react";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Msg, Spinner } from "../components/ui.jsx";

export default function Settings() {
  const { user, members, isParent, refresh } = useAuth();
  const [notes, setNotes] = useState(null);
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pin, setPin] = useState({ userId: "", pin: "" });
  useEffect(() => { get("/auth/notifications").then((n) => { setNotes(n); refresh(); }); if (isParent) get("/settings").then(setS); /* eslint-disable-next-line */ }, []);
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const setLang = async (lang) => { await post("/auth/language", { lang }); refresh(); };
  return (
    <div className="flex flex-col gap-4">
      <div className="text-xl font-semibold">الإعدادات</div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <Card title="لغة الواجهة"><div className="flex gap-2">{[["ar", "عربي"], ["mixed", "مختلط"], ["en", "English"]].map(([k, l]) => <button key={k} onClick={() => setLang(k)} className={`pill ${user.uiLanguage === k ? "bg-olive text-white border-transparent" : ""}`}>{l}</button>)}</div><div className="text-xs text-muted mt-2">المصطلحات الدينية تبقى بالعربي دائماً.</div></Card>
      <Card title="الإشعارات">{!notes ? <Spinner /> : notes.length === 0 ? <div className="text-xs text-muted">لا شيء</div> : notes.slice(0, 30).map((n) => <div key={n._id} className="text-sm py-2 border-b border-line last:border-0"><div>{n.body}</div><div className="text-[11px] text-muted">{new Date(n.createdAt).toLocaleString("ar-JO")}</div></div>)}</Card>
      {isParent && (
        <>
          <Card title="كلمة السر"><form onSubmit={async (e) => { e.preventDefault(); try { await post("/auth/change-password", pw); setMsg({ kind: "ok", text: "تغيّرت" }); setPw({ current: "", next: "" }); } catch { setMsg({ kind: "err", text: "الحالية غير صحيحة أو الجديدة قصيرة (٨+)" }); } }} className="flex gap-2"><input type="password" placeholder="الحالية" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><input type="password" placeholder="الجديدة" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><button className="btn-ghost">غيّر</button></form></Card>
          <Card title="رمز دخول الولد"><form onSubmit={async (e) => { e.preventDefault(); await post("/auth/reset-pin", pin); setMsg({ kind: "ok", text: "تغيّر الرمز وأُبلغ الولد" }); setPin({ userId: "", pin: "" }); }} className="flex gap-2"><select value={pin.userId} onChange={(e) => setPin({ ...pin, userId: e.target.value })} required><option value="">الولد</option>{kids.map((k) => <option key={k.id} value={k.id}>{k.displayName}</option>)}</select><input inputMode="numeric" placeholder="4–6 أرقام" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value })} /><button className="btn-ghost">ضبط</button></form><div className="text-xs text-muted mt-2">قفل تلقائي ١٥ دقيقة بعد ٣ محاولات خاطئة، مع إشعار لكما.</div></Card>
          {s && <Card title="النقاط والترفيه"><form onSubmit={async (e) => { e.preventDefault(); await post("/settings", s); setMsg({ kind: "ok", text: "حُفظت" }); }} className="grid grid-cols-2 gap-2">
            {[["points_per_dinar", "نقطة لكل دينار"], ["monthly_reward_cap_jod", "سقف المكافأة الشهري (د)"], ["fun_minutes_weekday_stage4", "ترفيه يومي Stage 4"], ["fun_minutes_weekday_stage6", "ترفيه يومي Stage 6"], ["fun_minutes_weekend_stage4", "عطلة Stage 4"], ["fun_minutes_weekend_stage6", "عطلة Stage 6"]].map(([k, l]) => <label key={k} className="text-xs text-muted">{l}<input className="w-full mt-1" type="number" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
            <button className="btn col-span-2">حفظ</button></form><div className="text-xs text-muted mt-2">٣٠٪ من المكافأة توفير إجباري. الترفيه يُفتح بإتمام المهام الإلزامية، ولا عقاب.</div></Card>}
          <Card title="من يشوف من"><div className="text-sm leading-relaxed">الأب يرى الجميع. الأم ترى الأولاد والبيت ونفسها، لا الأب. كل ولد يرى حسابه فقط. «عيلتنا» مشتركة للكل.</div></Card>
        </>
      )}
    </div>
  );
}
