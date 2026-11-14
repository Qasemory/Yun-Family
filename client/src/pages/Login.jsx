import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { ROLE_AR } from "../lib/i18n.js";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [members, setMembers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { get("/auth/members").then(setMembers).catch(() => setErr("الخادم غير متاح")); }, []);
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await login(picked.id, secret, picked.usesPin); nav("/", { replace: true }); }
    catch (ex) { setErr(ex.status === 423 ? "مقفل ١٥ دقيقة بعد محاولات خاطئة" : "بيانات غير صحيحة"); }
    finally { setBusy(false); }
  };
  return (
    <div dir="rtl" className="min-h-screen max-w-md mx-auto flex flex-col justify-center px-6 py-10">
      <div className="text-center mb-8"><div className="text-3xl font-bold">عيلتنا</div><div className="text-muted text-sm mt-1">مساعد عيلة الأمعري</div></div>
      <div className="card">
        <div className="font-semibold mb-3">مين إنت؟</div>
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <button key={m.id} type="button" onClick={() => { setPicked(m); setSecret(""); setErr(""); }} className={`rounded-2xl border p-3 text-right transition ${picked?.id === m.id ? "border-transparent text-white" : "border-line bg-white"}`} style={picked?.id === m.id ? { background: m.color } : {}}>
              <div className="font-semibold">{m.displayName}</div><div className={`text-xs ${picked?.id === m.id ? "text-white/80" : "text-muted"}`}>{ROLE_AR[m.role]}</div>
            </button>
          ))}
        </div>
        {picked && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
            <input autoFocus type="password" inputMode={picked.usesPin ? "numeric" : "text"} placeholder={picked.usesPin ? "رمز الدخول" : "كلمة السر"} value={secret} onChange={(e) => setSecret(e.target.value)} className="text-center tracking-widest" />
            {err && <div className="text-sm text-[#8A3B12]">{err}</div>}
            <button className="btn" disabled={busy || !secret}>دخول</button>
          </form>
        )}
      </div>
      <a href="/store" className="text-center text-xs text-muted mt-6 block">متجر يون كروشيه (عام)</a>
    </div>
  );
}
