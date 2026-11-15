import { useEffect, useState } from "react";
import { get, post, setToken } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Msg, PageTitle, PasswordInput, Spinner, StrengthMeter } from "../components/ui.jsx";

const errText = (t, ex) => t(`err.${ex?.data?.error}`, null, t("common.notSaved"));

/** تغيير كلمة السر من داخل الحساب */
function ChangePassword() {
  const { t } = useT();
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    if (pw.next !== pw.again) return setMsg({ kind: "err", text: t("pw.mismatch") });
    setBusy(true);
    try { const r = await post("/auth/change-password", { current: pw.current, next: pw.next }); if (r.token) setToken(r.token); setMsg({ kind: "ok", text: t("pw.changed") }); setPw({ current: "", next: "", again: "" }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
    finally { setBusy(false); }
  };
  return (
    <Card title={t("sec.changePassword")}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="text-xs text-muted" htmlFor="pw-cur">{t("pw.current")}</label>
        <PasswordInput id="pw-cur" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        <label className="text-xs text-muted mt-1" htmlFor="pw-new">{t("pw.new")}</label>
        <PasswordInput id="pw-new" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} />
        <StrengthMeter value={pw.next} />
        <label className="text-xs text-muted mt-1" htmlFor="pw-again">{t("pw.again")}</label>
        <PasswordInput id="pw-again" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required />
        <div className="text-xs text-muted">{t("pw.rules")}</div>
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
        <button className="btn sm:self-start" disabled={busy || !pw.current || pw.next.length < 8 || !pw.again}>{t("pw.change")}</button>
      </form>
    </Card>
  );
}

/** الإيميل وحالة تأكيده */
function EmailCard({ sec, reload }) {
  const { t } = useT();
  const [email, setEmail] = useState(sec.email || "");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await post("/auth/email", { email, password });
      setMsg(r.verified ? { kind: "ok", text: t("sec.emailSaved") } : r.sent ? { kind: "ok", text: t("sec.verifySent", { email }) } : { kind: "warn", text: t("sec.mailNotSent") });
      setPassword(""); reload();
    } catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setMsg(null);
    try { const r = await post("/auth/email/resend"); setMsg(r.sent ? { kind: "ok", text: t("sec.verifySent", { email: sec.email }) } : { kind: "warn", text: t("sec.mailNotSent") }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
  };
  return (
    <Card title={t("sec.email")} right={sec.email ? <span className={`pill ${sec.emailVerified ? "pill-green" : "pill-gold"}`}>{sec.emailVerified ? t("sec.verified") : t("sec.notVerified")}</span> : null}>
      <div className="text-xs text-muted mb-3">{t("sec.emailWhy")}</div>
      {!sec.mailReady && <div className="mb-3"><Msg kind="warn">{t("sec.mailNotReady")}</Msg></div>}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="text-xs text-muted" htmlFor="sec-email">{t("sec.email")}</label>
        <input id="sec-email" type="email" dir="ltr" autoComplete="email" inputMode="email" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="text-xs text-muted mt-1" htmlFor="sec-email-pw">{t("sec.confirmWithPassword")}</label>
        <PasswordInput id="sec-email-pw" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy || !email || !password}>{sec.email ? t("sec.updateEmail") : t("sec.saveEmail")}</button>
          {sec.email && !sec.emailVerified && <button type="button" className="btn-ghost" onClick={resend}>{t("sec.resend")}</button>}
        </div>
      </form>
    </Card>
  );
}

/** الأهل يغيّرون رمز دخول الولد */
function KidPin({ kids }) {
  const { t } = useT();
  const [pin, setPin] = useState({ userId: "", pin: "" });
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await post("/auth/reset-pin", pin); setMsg({ kind: "ok", text: t("sec.pinChanged") }); setPin({ userId: "", pin: "" }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
  };
  return (
    <Card title={t("sec.kidPin")}>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <select value={pin.userId} onChange={(e) => setPin({ ...pin, userId: e.target.value })} required aria-label={t("sec.child")}><option value="">{t("sec.child")}</option>{kids.map((k) => <option key={k.id} value={k.id}>{k.displayName}</option>)}</select>
        <input inputMode="numeric" pattern="\d{4,6}" dir="ltr" placeholder={t("sec.pinDigits")} aria-label={t("sec.pinDigits")} value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} required />
        <button className="btn-ghost">{t("sec.set")}</button>
      </form>
      {msg && <div className="mt-2"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
      <div className="text-xs text-muted mt-2">{t("sec.pinLock")}</div>
    </Card>
  );
}

/** الأب يعيد ضبط كلمة سر الأم */
function ResetAdmin({ admins }) {
  const { t } = useT();
  const [f, setF] = useState({ userId: admins[0]?.id || "", next: "" });
  const [msg, setMsg] = useState(null);
  if (!admins.length) return null;
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    try { await post("/auth/reset-password-for", f); setMsg({ kind: "ok", text: t("sec.adminReset", { name: admins.find((a) => String(a.id) === String(f.userId))?.displayName || "" }) }); setF({ ...f, next: "" }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
  };
  return (
    <Card title={t("sec.resetAdmin")}>
      <div className="text-xs text-muted mb-3">{t("sec.resetAdminWhy")}</div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        {admins.length > 1 && <select value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} aria-label={t("sec.who")}>{admins.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</select>}
        <label className="text-xs text-muted" htmlFor="adm-new">{t("sec.newPasswordFor", { name: admins.find((a) => String(a.id) === String(f.userId))?.displayName || "" })}</label>
        <PasswordInput id="adm-new" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required minLength={8} />
        <StrengthMeter value={f.next} />
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
        <button className="btn-ghost sm:self-start" disabled={f.next.length < 8}>{t("sec.resetBtn")}</button>
      </form>
    </Card>
  );
}

function RecentActivity({ recent }) {
  const { t, locale } = useT();
  return (
    <Card title={t("sec.recent")}>
      {recent.length === 0 ? <div className="text-xs text-muted">{t("common.nothingYet")}</div> : recent.map((a) => (
        <div key={a.id} className="row text-sm">
          <span className="min-w-0">{t(`audit.${a.action}`, null, a.action)}{a.who ? ` · ${a.who}` : ""}{a.detail && a.action === "password_reset_by_owner" ? ` → ${a.detail}` : ""}</span>
          <span className="text-[11px] text-muted whitespace-nowrap">{new Date(a.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
      ))}
    </Card>
  );
}

function AiStatus() {
  const { t } = useT();
  const [a, setA] = useState(null);
  useEffect(() => { get("/ai/status").then(setA).catch(() => {}); }, []);
  if (!a) return null;
  return (
    <Card title={t("ai.status")} right={<span className={`pill ${a.ready ? "pill-green" : ""}`}>{a.ready ? t("ai.on") : t("ai.offShort")}</span>}>
      {a.ready ? <div className="text-sm">{t("ai.today", { n: a.calls || 0, max: a.limit })} · <span dir="ltr" className="text-xs text-muted">{a.model}</span></div> : <div className="text-sm text-muted">{t("ai.off")}</div>}
      <div className="text-xs text-muted mt-1">{t("ai.hint")}</div>
    </Card>
  );
}

export default function Settings() {
  const { user, members, isParent, refresh } = useAuth();
  const { t, locale } = useT();
  const [notes, setNotes] = useState(null);
  const [s, setS] = useState(null);
  const [sec, setSec] = useState(null);
  const [msg, setMsg] = useState(null);
  const loadSec = () => get("/auth/security").then(setSec).catch(() => setSec(null));
  useEffect(() => {
    get("/auth/notifications").then((n) => { setNotes(n); refresh(); });
    if (isParent) { get("/settings").then(setS); loadSec(); }
    /* eslint-disable-next-line */
  }, []);
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const admins = members.filter((m) => m.role === "admin");
  const setLang = async (lang) => { await post("/auth/language", { lang }); refresh(); };
  const langs = isParent ? ["ar", "en"] : ["ar", "mixed"];
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("nav.settings")}</PageTitle>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card title={t("settings.language")}>
          <div className="flex flex-wrap gap-2">{langs.map((k) => <button key={k} onClick={() => setLang(k)} className={`pill ${user.uiLanguage === k || (k === "ar" && !langs.includes(user.uiLanguage)) ? "bg-olive text-white border-transparent" : ""}`}>{t(`settings.lang.${k}`)}</button>)}</div>
          <div className="text-xs text-muted mt-2">{t(isParent ? "settings.langNoteParent" : "settings.langNoteChild")}</div>
        </Card>
        <Card title={t("notifications")}>
          {!notes ? <Spinner /> : notes.length === 0 ? <div className="text-xs text-muted">{t("common.nothingYet")}</div> : <div className="max-h-80 overflow-y-auto -me-2 pe-2">{notes.slice(0, 30).map((n) => <div key={n._id} className="text-sm py-2 border-b border-line last:border-0"><div dir="auto">{n.body}</div><div className="text-[11px] text-muted">{new Date(n.createdAt).toLocaleString(locale)}</div></div>)}</div>}
        </Card>
      </div>

      {isParent && (
        <>
          <h2 className="section text-base text-ink mt-4">{t("sec.title")}</h2>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <ChangePassword />
            {sec ? <EmailCard key={sec.email} sec={sec} reload={loadSec} /> : <Card title={t("sec.email")}><Spinner /></Card>}
            <KidPin kids={kids} />
            {user.role === "owner" && <ResetAdmin admins={admins} />}
            {sec && <RecentActivity recent={sec.recent} />}
            <AiStatus />
          </div>

          <h2 className="section text-base text-ink mt-4">{t("settings.family")}</h2>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {s && <Card title={t("settings.pointsFun")}><form onSubmit={async (e) => { e.preventDefault(); await post("/settings", s); setMsg({ kind: "ok", text: t("common.saved") }); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["points_per_dinar", "monthly_reward_cap_jod", "fun_minutes_weekday_stage4", "fun_minutes_weekday_stage6", "fun_minutes_weekend_stage4", "fun_minutes_weekend_stage6"].map((k) => <label key={k} className="text-xs text-muted">{t(`settings.k.${k}`)}<input className="w-full mt-1" type="number" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
              <button className="btn sm:col-span-2 sm:justify-self-start">{t("common.save")}</button></form><div className="text-xs text-muted mt-2">{t("settings.pointsNote")}</div></Card>}
            <Card title={t("settings.whoSees")}><div className="text-sm leading-relaxed">{t("settings.whoSeesText")}</div></Card>
          </div>
        </>
      )}
    </div>
  );
}
