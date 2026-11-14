import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Msg, Spinner, MemberTabs, Stat } from "../components/ui.jsx";

const TREND = { improving: ["متحسّن", "pill-green"], steady: ["ثابت", ""], attention: ["محتاج انتباه", "pill-gold"], not_enough: ["بداية المتابعة", ""] };

function Chart({ chart }) {
  if (!chart?.points?.length || chart.points.length < 2) return null;
  const n = chart.points.length, X = (i) => 10 + (i * 300) / (n - 1), Y = (y) => 100 - y * 80;
  return (
    <svg viewBox="0 0 320 112" className="w-full mt-3" aria-hidden="true">
      {chart.band && <rect x="0" y={Y(chart.band.high)} width="320" height={(chart.band.high - chart.band.low) * 80} fill="#DDEEEA" rx="4" />}
      <polyline fill="none" stroke="#1F7A6D" strokeWidth="3" strokeLinejoin="round" points={chart.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} />
      {chart.points.map((p) => <g key={p.x}><circle cx={X(p.x)} cy={Y(p.y)} r="4" fill="#1F7A6D" />{p.v != null && <text x={X(p.x)} y={Y(p.y) - 8} fontSize="9" textAnchor="middle" fill="#5F6B68">{p.v}</text>}</g>)}
    </svg>
  );
}

export default function Health() {
  const { user, members, isParent } = useAuth();
  const [sp, setSp] = useSearchParams();
  const u = sp.get("u") || user.id;
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ weight: "", height_cm: "", day: "" });
  const [goal, setGoal] = useState({});
  const load = () => get(`/health?u=${u}`).then((r) => { setD(r); setGoal(r.weight.goal || {}); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const w = d.weight, self = String(u) === String(user.id);
  const canMeasure = (isParent && d.subject.isChild) || (self && !d.subject.isChild);
  const [trendLabel, trendCls] = TREND[w.trend.status];
  const save = async (e) => { e.preventDefault(); try { const r = await post("/health/weight", { userId: u, ...form }); setMsg({ kind: "ok", text: r.results.some((x) => x.points) ? "تسجّل +١٠ (فحص الأحد)" : "تسجّل" }); setForm({ weight: "", height_cm: "", day: "" }); load(); } catch (ex) { setMsg({ kind: "err", text: ex.data?.reason === "child_needs_parent" ? "وزن الأولاد يسجّله الأهل" : "لم يُحفظ" }); } };
  const saveGoal = async (e) => { e.preventDefault(); await post("/health/goal", { userId: u, ...goal }); setMsg({ kind: "ok", text: "حُفظ الهدف" }); load(); };
  const daily = async (metric, value) => { await post("/health/daily", { userId: u, metric, value }); load(); };
  const link = async () => { await post("/health/scale-link", { userId: u }); load(); };
  const base = window.location.origin;
  return (
    <div className="flex flex-col gap-4">
      {isParent && <MemberTabs members={members} value={u} onChange={(id) => setSp({ u: id })} />}
      <div className="text-xl font-semibold">صحة {d.subject.displayName}</div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}

      <Card title="رحلتي الصحية · فحص الأحد" right={<span className={`pill ${w.checkedInThisWeek ? "pill-green" : ""}`}>{w.checkedInThisWeek ? "سُجّل هالأسبوع" : "لسا ما انقاس"}</span>} className={w.trend.status === "improving" ? "border-olive border-2" : ""}>
        <div className="flex items-center gap-2"><span className={`pill ${trendCls}`}>{trendLabel}</span>
          {w.showNumber && w.weight && <span className="text-sm text-muted">{w.weight} كغ · {w.weightDay}{w.bmi ? ` · BMI ${w.bmi}` : ""}{w.zone ? ` · ${w.zone.labelAr}${w.zone.approx ? " (تقريبي للعمر)" : ""}` : ""}</span>}
          {!w.showNumber && w.zoneLabel && <span className="text-sm text-muted">{w.zoneLabel}</span>}</div>
        <Chart chart={w.chart} />
        <div className="reading mt-2 text-[17px]">{w.message}</div>
        {w.milestones?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{w.milestones.map((m) => <span key={m} className="pill pill-gold">{m}</span>)}</div>}
        {w.alerts?.map((a) => <Msg key={a} kind="err">{a}</Msg>)}
      </Card>

      {canMeasure && (
        <>
          <Card title="تسجيل القياس">
            {d.subject.isChild && <div className="text-xs text-muted mb-2">يُقاس الولد بوجود أحد الأهل · +١٠ نقاط له أول مرة بالأسبوع</div>}
            <form onSubmit={save} className="flex flex-wrap gap-2">
              <input className="w-28" type="number" step="0.1" placeholder="الوزن كغ" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              <input className="w-28" type="number" step="0.5" placeholder="الطول سم" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
              <input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
              <button className="btn">حفظ</button>
            </form>
          </Card>
          <Card title="الهدف والنطاق الأخضر">
            <form onSubmit={saveGoal} className="flex flex-wrap gap-2">
              <input className="w-20" type="number" step="0.1" placeholder="من" value={goal.targetLow ?? ""} onChange={(e) => setGoal({ ...goal, targetLow: e.target.value })} />
              <input className="w-20" type="number" step="0.1" placeholder="إلى" value={goal.targetHigh ?? ""} onChange={(e) => setGoal({ ...goal, targetHigh: e.target.value })} />
              <select value={goal.direction || "keep"} onChange={(e) => setGoal({ ...goal, direction: e.target.value })}><option value="down">نزول</option><option value="up">زيادة</option><option value="keep">ثبات</option></select>
              {d.subject.isChild && <select value={goal.visibility || "trend"} onChange={(e) => setGoal({ ...goal, visibility: e.target.value })}><option value="number">الولد يرى الرقم</option><option value="trend">الاتجاه فقط</option></select>}
              <input className="flex-1" placeholder="ملاحظة الطبيب" value={goal.note || ""} onChange={(e) => setGoal({ ...goal, note: e.target.value })} />
              <button className="btn-ghost">حفظ</button>
            </form>
          </Card>
          <Card title="ربط الميزان">
            {d.scale ? (
              <>
                <div className="text-xs text-muted">الرابط الذي يرسل إليه الميزان أو تطبيق الصحة:</div>
                <code dir="ltr" className="block text-[11px] bg-ivory rounded-lg p-2 mt-1 break-all">POST {base}/api/scale {`{"token":"${d.scale.token}","weight_kg":62.4}`}</code>
                <div className="text-xs text-muted mt-2">آيفون: الاختصارات ← أتمتة ← «عند تسجيل عينة وزن في الصحة» ← «الحصول على محتويات URL» بطريقة POST والمحتوى أعلاه. أندرويد: Health Connect عبر MacroDroid أو IFTTT بنفس الطلب.</div>
              </>
            ) : <button className="btn-ghost btn-sm" onClick={link}>أنشئ رمز الربط</button>}
          </Card>
        </>
      )}

      <Card title="اليوم">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="نوم (ساعات)" value={d.daily.sleep ?? "—"} sub={`الهدف ${d.daily.sleepTarget}`} />
          <Stat label="ماء (أكواب)" value={d.daily.water ?? 0} sub={`الهدف ${d.daily.waterTarget}`} />
          <Stat label="شعوري" value={d.daily.mood ?? "—"} sub="١–٥" />
        </div>
        {self && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-ghost btn-sm" onClick={() => daily("water_cups", (d.daily.water || 0) + 1)}>+ كوب ماء</button>
            {[7, 8, 9, 10].map((h) => <button key={h} className="btn-ghost btn-sm" onClick={() => daily("sleep_h", h)}>نمت {h}</button>)}
            {[1, 2, 3, 4, 5].map((m) => <button key={m} className="btn-ghost btn-sm" onClick={() => daily("mood", m)}>{"★".repeat(m)}</button>)}
          </div>
        )}
        <div className="section">مهاراتي</div>
        <div className="grid grid-cols-2 gap-2">
          {d.daily.skills.map((s) => (
            <div key={s.skill} className="bg-ivory rounded-xl p-3 flex items-center justify-between"><div><div className="text-sm font-semibold">{s.skill}</div><div className="text-xs text-muted">أفضل: {s.best ?? "—"}</div></div>
              {self && <button className="btn-ghost btn-sm" onClick={() => { const v = window.prompt("الرقم الجديد؟"); if (v) daily(`skill:${s.skill}`, Number(v)); }}>سجّل</button>}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
