// صفحات الدخول العامة للعيلة: الدخول، نسيت كلمة السر، كلمة سر جديدة، تأكيد الإيميل
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT, useDocumentLang } from "../lib/i18n.js";
import { fam } from "../lib/paths.js";
import { Msg, PasswordInput, StrengthMeter } from "../components/ui.jsx";

export function AuthShell({ title, subtitle, children }) {
  const { t, lang, dir } = useT();
  useDocumentLang(lang, dir, t("appName"));
  return (
    <div dir={dir} className="min-h-screen bg-ivory flex items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="text-center mb-6 sm:mb-8"><div className="text-3xl sm:text-4xl font-bold">{t("appName")}</div>{title && <h1 className="text-lg font-semibold mt-3">{title}</h1>}{subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}</div>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login, user, logout } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [need2fa, setNeed2fa] = useState(false);
  const [code, setCode] = useState("");
  const justIn = useRef(false);
  // بعد ما يدخل من هون بنروح للرئيسية. أما لو كان في جلسة قديمة على الجهاز، بنسأله بدل ما نحوّله لحاله
  useEffect(() => { if (user && justIn.current) nav(fam(), { replace: true }); }, [user, nav]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { justIn.current = true; await login(name, secret, need2fa ? code : undefined); nav(fam(), { replace: true }); }
    catch (ex) {
      justIn.current = false;
      if (ex.message === "need_2fa") { setNeed2fa(true); setErr(""); }
      else if (ex.message === "bad_2fa") { setErr(t("tfa.badCode")); setCode(""); }
      else setErr(ex.status === 423 ? t("auth.locked") : ex.status === 429 ? t("err.too_many") : ex.status === 400 ? t("auth.wrong") : t("auth.serverDown"));
    }
    finally { setBusy(false); }
  };
  if (user && !justIn.current) return (
    <AuthShell>
      <div className="card flex flex-col gap-3 text-center">
        <div className="text-sm text-muted">{t("auth.alreadyIn")}</div>
        <div className="flex items-center justify-center gap-2 text-lg font-semibold"><span className="w-9 h-9 rounded-full text-white flex items-center justify-center" style={{ background: user.color }}>{user.displayName?.[0]}</span>{user.displayName}</div>
        <button className="btn" onClick={() => nav(fam(), { replace: true })}>{t("auth.continueAs", { name: user.displayName })}</button>
        <button className="btn-ghost" onClick={logout}>{t("auth.otherAccount")}</button>
      </div>
    </AuthShell>
  );
  return (
    <AuthShell>
      <form onSubmit={submit} className="card flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="login-name">{t("auth.name")}</label>
        <input id="login-name" autoFocus autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePh")} />
        <label className="text-sm font-semibold mt-2" htmlFor="login-secret">{t("auth.secret")}</label>
        <PasswordInput id="login-secret" value={secret} onChange={(e) => setSecret(e.target.value)} className="[&_input]:text-center [&_input]:tracking-widest" />
        {need2fa && (
          <>
            <label className="text-sm font-semibold mt-2" htmlFor="login-code">{t("tfa.code")}</label>
            <input id="login-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" className="text-center tracking-[.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <div className="text-xs text-muted">{t("tfa.loginHint")}</div>
          </>
        )}
        {err && <Msg kind="err">{err}</Msg>}
        <button className="btn mt-2" disabled={busy || !name.trim() || !secret || (need2fa && code.length !== 6)}>{busy ? "…" : t("auth.enter")}</button>
        <Link to={fam("/forgot")} className="text-center text-sm text-olive mt-2">{t("auth.forgot")}</Link>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | sent | error
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setState("busy"); setErr("");
    try { await api("/auth/forgot", { method: "POST", body: { email }, auth: false }); setState("sent"); }
    catch (ex) { setErr(ex.status === 429 ? t("err.too_many") : t("auth.serverDown")); setState("error"); }
  };
  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={state === "sent" ? null : t("auth.forgotSub")}>
      <div className="card flex flex-col gap-3">
        {state === "sent" ? (
          <>
            <Msg kind="ok">{t("auth.forgotSent", { email })}</Msg>
            <p className="text-xs text-muted">{t("auth.forgotHint")}</p>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="fp-email">{t("sec.email")}</label>
            <input id="fp-email" type="email" dir="ltr" autoFocus autoComplete="email" inputMode="email" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {err && <Msg kind="err">{err}</Msg>}
            <button className="btn mt-2" disabled={state === "busy" || !email}>{state === "busy" ? "…" : t("auth.sendLink")}</button>
            <p className="text-xs text-muted">{t("auth.kidsNote")}</p>
          </form>
        )}
        <Link to={fam("/login")} className="text-center text-sm text-olive">{t("auth.backToLogin")}</Link>
      </div>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { t } = useT();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [pw, setPw] = useState({ next: "", again: "" });
  const [state, setState] = useState("idle"); // idle | busy | done
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (pw.next !== pw.again) return setErr(t("pw.mismatch"));
    setState("busy");
    try { await api("/auth/reset", { method: "POST", body: { token, password: pw.next }, auth: false }); setState("done"); }
    catch (ex) { setErr(t(`err.${ex.data?.error}`, null, t("auth.serverDown"))); setState("idle"); }
  };
  if (!token) return <AuthShell title={t("auth.resetTitle")}><div className="card flex flex-col gap-3"><Msg kind="err">{t("err.bad_token")}</Msg><Link to={fam("/forgot")} className="btn">{t("auth.requestNew")}</Link></div></AuthShell>;
  return (
    <AuthShell title={t("auth.resetTitle")}>
      <div className="card flex flex-col gap-3">
        {state === "done" ? (
          <>
            <Msg kind="ok">{t("auth.resetDone")}</Msg>
            <Link to={fam("/login")} className="btn">{t("auth.enter")}</Link>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="rp-new">{t("pw.new")}</label>
            <PasswordInput id="rp-new" autoFocus autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} />
            <StrengthMeter value={pw.next} />
            <label className="text-sm font-semibold mt-1" htmlFor="rp-again">{t("pw.again")}</label>
            <PasswordInput id="rp-again" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required />
            <div className="text-xs text-muted">{t("pw.rules")}</div>
            {err && <Msg kind="err">{err}</Msg>}
            {err === t("err.bad_token") && <Link to={fam("/forgot")} className="text-sm text-olive">{t("auth.requestNew")}</Link>}
            <button className="btn mt-2" disabled={state === "busy" || pw.next.length < 8 || !pw.again}>{state === "busy" ? "…" : t("auth.savePassword")}</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

export function VerifyEmail() {
  const { t } = useT();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [state, setState] = useState(token ? "busy" : "bad");
  useEffect(() => {
    if (!token) return;
    api("/auth/email/verify", { method: "POST", body: { token }, auth: false }).then(() => setState("ok")).catch(() => setState("bad"));
  }, [token]);
  return (
    <AuthShell title={t("auth.verifyTitle")}>
      <div className="card flex flex-col gap-3">
        {state === "busy" && <div className="text-center text-muted py-4">…</div>}
        {state === "ok" && <Msg kind="ok">{t("auth.verifyOk")}</Msg>}
        {state === "bad" && <Msg kind="err">{t("auth.verifyBad")}</Msg>}
        <Link to={user ? fam("/settings") : fam("/login")} className="btn">{user ? t("nav.settings") : t("auth.enter")}</Link>
      </div>
    </AuthShell>
  );
}
