import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { fam } from "../lib/paths.js";

// شاشة دخول العيلة: الاسم يُكتب باليد، ولا تُعرض قائمة الأسماء لأي زائر
export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = "عيلتنا"; }, []);
  useEffect(() => { if (user) nav(fam(), { replace: true }); }, [user, nav]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await login(name, secret); nav(fam(), { replace: true }); }
    catch (ex) {
      if (ex.status === 423) setErr("مقفل ١٥ دقيقة بعد محاولات خاطئة");
      else if (ex.status === 400) setErr("الاسم أو كلمة السر غير صحيحة");
      else setErr("الخادم غير متاح، جرّب بعد شوي");
    }
    finally { setBusy(false); }
  };
  return (
    <div dir="rtl" className="min-h-screen max-w-md mx-auto flex flex-col justify-center px-6 py-10">
      <div className="text-center mb-8"><div className="text-3xl font-bold">عيلتنا</div></div>
      <form onSubmit={submit} className="card flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="login-name">الاسم</label>
        <input id="login-name" autoFocus autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" />
        <label className="text-sm font-semibold mt-2" htmlFor="login-secret">كلمة السر أو الرمز</label>
        <input id="login-secret" type="password" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} className="text-center tracking-widest" />
        {err && <div className="text-sm text-[#8A3B12]">{err}</div>}
        <button className="btn mt-2" disabled={busy || !name.trim() || !secret}>{busy ? "…" : "دخول"}</button>
      </form>
    </div>
  );
}
