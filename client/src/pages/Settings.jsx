import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PushCard } from "../components/PushCard.jsx";
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

/** التحقق بخطوتين: رمز من تطبيق المصادقة فوق كلمة السر */
function TwoFactor({ sec, reload }) {
  const { t } = useT();
  const [setup, setSetup] = useState(null);   // { secret, url, qr }
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);
  const start = async () => {
    setMsg(null);
    try { const r = await post("/auth/2fa/setup"); setSetup({ ...r, qr: await QRCode.toDataURL(r.url, { margin: 1, width: 220 }) }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
  };
  const enable = async (e) => {
    e.preventDefault();
    try { await post("/auth/2fa/enable", { code }); setSetup(null); setCode(""); setMsg({ kind: "ok", text: t("tfa.enabled") }); reload(); }
    catch { setMsg({ kind: "err", text: t("tfa.badCode") }); }
  };
  const disable = async (e) => {
    e.preventDefault();
    try { await post("/auth/2fa/disable", { password: pw, code }); setPw(""); setCode(""); setMsg({ kind: "ok", text: t("tfa.disabled") }); reload(); }
    catch (ex) { setMsg({ kind: "err", text: ex?.data?.error === "bad_current" ? t("err.bad_current") : t("tfa.badCode") }); }
  };
  const codeInput = <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" dir="ltr" className="text-center tracking-[.4em] w-40" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label={t("tfa.code")} />;
  return (
    <Card title={t("tfa.title")} right={<span className={`pill ${sec.totpEnabled ? "pill-green" : ""}`}>{sec.totpEnabled ? t("ai.on") : t("ai.offShort")}</span>}>
      <div className="text-xs text-muted mb-3">{t("tfa.why")}</div>
      {sec.totpEnabled ? (
        <form onSubmit={disable} className="flex flex-col gap-2">
          <div className="text-sm">{t("tfa.toDisable")}</div>
          <PasswordInput autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("sec.current")} />
          {codeInput}
          <button className="btn-ghost sm:self-start" disabled={!pw || code.length !== 6}>{t("tfa.disable")}</button>
        </form>
      ) : setup ? (
        <form onSubmit={enable} className="flex flex-col gap-2">
          <ol className="text-sm list-decimal ps-5 flex flex-col gap-1"><li>{t("tfa.step1")}</li><li>{t("tfa.step2")}</li><li>{t("tfa.step3")}</li></ol>
          <img src={setup.qr} alt={t("tfa.qrAlt")} className="w-44 h-44 border border-line rounded-xl self-center sm:self-start" />
          <div className="text-xs text-muted">{t("tfa.manual")} <code dir="ltr" className="select-all break-all bg-ivory px-1 rounded">{setup.secret}</code></div>
          {codeInput}
          <div className="flex gap-2"><button className="btn" disabled={code.length !== 6}>{t("tfa.enable")}</button><button type="button" className="btn-ghost" onClick={() => setSetup(null)}>{t("common.cancel")}</button></div>
        </form>
      ) : <button className="btn sm:self-start" onClick={start}>{t("tfa.start")}</button>}
      {msg && <div className="mt-2"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
    </Card>
  );
}

function Reset2faAdmin({ admins }) {
  const { t } = useT();
  const [msg, setMsg] = useState(null);
  if (!admins.length) return null;
  const go = async (a) => {
    if (!window.confirm(t("tfa.resetConfirm", { name: a.displayName }))) return;
    try { await post("/auth/2fa/reset-for", { userId: a.id }); setMsg({ kind: "ok", text: t("tfa.resetDone", { name: a.displayName }) }); }
    catch (ex) { setMsg({ kind: "err", text: errText(t, ex) }); }
  };
  return (
    <div className="text-xs text-muted">
      {admins.map((a) => <button key={a.id} className="underline me-3" onClick={() => go(a)}>{t("tfa.resetFor", { name: a.displayName })}</button>)}
      {msg && <div className="mt-2"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
    </div>
  );
}

/** ربط تيليجرام: الإشعارات توصل على تيليجرام + أوامر سريعة */
export function TelegramCard() {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [link, setLink] = useState(null);
  const load = () => get("/telegram/status").then(setSt).catch(() => setSt({ ready: false }));
  useEffect(() => { load(); }, []);
  if (!st) return null;
  const make = async () => { try { setLink(await post("/telegram/link")); } catch { setLink(null); } };
  const unlink = async () => { await post("/telegram/unlink"); setLink(null); load(); };
  return (
    <Card title="Telegram" right={<span className={`pill ${st.linked ? "pill-green" : ""}`}>{st.linked ? t("tg.linked") : t("tg.notLinked")}</span>}>
      {!st.ready ? <div className="text-sm text-muted">{t("tg.off")}</div> : st.linked ? (
        <div className="flex flex-col gap-2"><div className="text-sm">{t("tg.linkedText")}</div><button className="btn-ghost btn-sm self-start" onClick={unlink}>{t("tg.unlink")}</button></div>
      ) : link ? (
        <div className="flex flex-col gap-2 text-sm">
          {link.url ? <a className="btn self-start" href={link.url} target="_blank" rel="noreferrer">{t("tg.open")}</a> : null}
          <div className="text-xs text-muted">{t("tg.manual", { bot: link.bot ? `@${link.bot}` : "" })} <code dir="ltr" className="select-all bg-ivory px-1 rounded">/start {link.code}</code></div>
          <button className="btn-ghost btn-sm self-start" onClick={load}>{t("tg.check")}</button>
        </div>
      ) : <div className="flex flex-col gap-2"><div className="text-sm">{t("tg.why")}</div><button className="btn btn-sm self-start" onClick={make}>{t("tg.link")}</button></div>}
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
        <PushCard />
        <Card title={t("settings.language")}>
          <div className="flex flex-wrap gap-2">{langs.map((k) => <button key={k} onClick={() => setLang(k)} className={`pill ${user.uiLanguage === k || (k === "ar" && !langs.includes(user.uiLanguage)) ? "bg-olive text-white border-transparent" : ""}`}>{t(`settings.lang.${k}`)}</button>)}</div>
          <div className="text-xs text-muted mt-2">{t(isParent ? "settings.langNoteParent" : "settings.langNoteChild")}</div>
        </Card>
        <Card title={t("notifications")}>
          {!notes ? <Spinner /> : notes.length === 0 ? <div className="text-xs text-muted">{t("common.nothingYet")}</div> : <div className="max-h-80 overflow-y-auto -me-2 pe-2">{notes.slice(0, 30).map((n) => <div key={n._id} className="text-sm py-2 border-b border-line last:border-0"><div dir="auto">{n.body}</div><div className="text-[11px] text-muted">{new Date(n.createdAt).toLocaleString(locale)}</div></div>)}</div>}
        </Card>
      </div>

      {!isParent && <div className="grid gap-4 lg:grid-cols-2"><TelegramCard /></div>}
      {isParent && (
        <>
          <h2 className="section text-base text-ink mt-4">{t("sec.title")}</h2>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <ChangePassword />
            {sec ? <EmailCard key={sec.email} sec={sec} reload={loadSec} /> : <Card title={t("sec.email")}><Spinner /></Card>}
            <KidPin kids={kids} />
            {sec && <div className="flex flex-col gap-2"><TwoFactor sec={sec} reload={loadSec} />{user.role === "owner" && <Reset2faAdmin admins={admins} />}</div>}
            {user.role === "owner" && <ResetAdmin admins={admins} />}
            <TelegramCard />
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
