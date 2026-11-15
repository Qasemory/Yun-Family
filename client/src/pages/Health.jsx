import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post, API_BASE } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Msg, Spinner, MemberTabs, PageTitle, Stat } from "../components/ui.jsx";

const TREND_CLS = { improving: "pill-green", steady: "", attention: "pill-gold", not_enough: "" };

function Chart({ chart }) {
  if (!chart?.points?.length || chart.points.length < 2) return null;
  const n = chart.points.length, X = (i) => 10 + (i * 300) / (n - 1), Y = (y) => 100 - y * 80;
  // الرسم دائماً من اليسار لليمين (الزمن) حتى بالعربي
  return (
    <svg viewBox="0 0 320 112" className="w-full max-h-64 mt-3" aria-hidden="true" style={{ direction: "ltr" }}>
      {chart.band && <rect x="0" y={Y(chart.band.high)} width="320" height={(chart.band.high - chart.band.low) * 80} fill="#DDEEEA" rx="4" />}
      <polyline fill="none" stroke="#1F7A6D" strokeWidth="3" strokeLinejoin="round" points={chart.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} />
      {chart.points.map((p) => <g key={p.x}><circle cx={X(p.x)} cy={Y(p.y)} r="4" fill="#1F7A6D" />{p.v != null && <text x={X(p.x)} y={Y(p.y) - 8} fontSize="9" textAnchor="middle" fill="#5F6B68">{p.v}</text>}</g>)}
    </svg>
  );
}

export default function Health() {
  const { user, members, isParent } = useAuth();
  const { t } = useT();
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
  const save = async (e) => { e.preventDefault(); try { const r = await post("/health/weight", { userId: u, ...form }); setMsg({ kind: "ok", text: r.results.some((x) => x.points) ? t("health.savedPoints") : t("common.saved") }); setForm({ weight: "", height_cm: "", day: "" }); load(); } catch (ex) { setMsg({ kind: "err", text: ex.data?.reason === "child_needs_parent" ? t("health.childNeedsParent") : t("common.notSaved") }); } };
  const saveGoal = async (e) => { e.preventDefault(); await post("/health/goal", { userId: u, ...goal }); setMsg({ kind: "ok", text: t("health.goalSaved") }); load(); };
  const daily = async (metric, value) => { await post("/health/daily", { userId: u, metric, value }); load(); };
  const link = async () => { await post("/health/scale-link", { userId: u }); load(); };
  const base = API_BASE || window.location.origin;
  return (
    <div className="flex flex-col gap-4">
      {isParent && <MemberTabs members={members} value={u} onChange={(id) => setSp({ u: id })} />}
      <PageTitle>{t("health.titleOf", { name: d.subject.displayName })}</PageTitle>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card title={t("health.journey")} right={<span className={`pill ${w.checkedInThisWeek ? "pill-green" : ""}`}>{w.checkedInThisWeek ? t("health.checkedIn") : t("health.notMeasured")}</span>} className={w.trend.status === "improving" ? "border-olive border-2" : ""}>
          <div className="flex flex-wrap items-center gap-2"><span className={`pill ${TREND_CLS[w.trend.status] || ""}`}>{t(`health.trend.${w.trend.status}`)}</span>
            {w.showNumber && w.weight && <span className="text-sm text-muted">{w.weight} {t("health.kg")} · <span dir="ltr">{w.weightDay}</span>{w.bmi ? ` · BMI ${w.bmi}` : ""}{w.zone ? ` · ${w.zone.labelAr}${w.zone.approx ? ` (${t("health.approxAge")})` : ""}` : ""}</span>}
            {!w.showNumber && w.zoneLabel && <span className="text-sm text-muted">{w.zoneLabel}</span>}</div>
          <Chart chart={w.chart} />
          <div className="reading mt-2 text-[17px]" dir="auto">{w.message}</div>
          {w.milestones?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{w.milestones.map((m) => <span key={m} className="pill pill-gold">{m}</span>)}</div>}
          <div className="flex flex-col gap-2 mt-2">{w.alerts?.map((a) => <Msg key={a} kind="err">{a}</Msg>)}</div>
        </Card>

        <Card title={t("common.today")}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t("health.sleep")} value={d.daily.sleep ?? "—"} sub={t("health.target", { n: d.daily.sleepTarget })} />
            <Stat label={t("health.water")} value={d.daily.water ?? 0} sub={t("health.target", { n: d.daily.waterTarget })} />
            <Stat label={t("health.mood")} value={d.daily.mood ?? "—"} sub="1–5" />
          </div>
          {self && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-ghost btn-sm" onClick={() => daily("water_cups", (d.daily.water || 0) + 1)}>{t("health.addWater")}</button>
              {[7, 8, 9, 10].map((h) => <button key={h} className="btn-ghost btn-sm" onClick={() => daily("sleep_h", h)}>{t("health.slept", { n: h })}</button>)}
              {[1, 2, 3, 4, 5].map((m) => <button key={m} className="btn-ghost btn-sm" aria-label={t("health.moodN", { n: m })} onClick={() => daily("mood", m)}>{"★".repeat(m)}</button>)}
            </div>
          )}
          <div className="section">{t("health.skills")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {d.daily.skills.map((s) => (
              <div key={s.skill} className="bg-ivory rounded-xl p-3 flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-sm font-semibold">{s.skill}</div><div className="text-xs text-muted">{t("health.best")} {s.best ?? "—"}</div></div>
                {self && <button className="btn-ghost btn-sm" onClick={() => { const v = window.prompt(t("health.newNumber")); if (v) daily(`skill:${s.skill}`, Number(v)); }}>{t("health.log")}</button>}</div>
            ))}
          </div>
        </Card>

        {canMeasure && (
          <>
            <Card title={t("health.measure")}>
              {d.subject.isChild && <div className="text-xs text-muted mb-2">{t("health.childNote")}</div>}
              <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.3fr_auto] gap-2">
                <input type="number" inputMode="decimal" step="0.1" placeholder={t("health.weightKg")} aria-label={t("health.weightKg")} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                <input type="number" inputMode="decimal" step="0.5" placeholder={t("health.heightCm")} aria-label={t("health.heightCm")} value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
                <input type="date" className="col-span-2 sm:col-span-1" aria-label={t("health.date")} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
                <button className="btn col-span-2 sm:col-span-1">{t("common.save")}</button>
              </form>
            </Card>
            <Card title={t("health.goal")}>
              <form onSubmit={saveGoal} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="number" step="0.1" placeholder={t("health.from")} aria-label={t("health.from")} value={goal.targetLow ?? ""} onChange={(e) => setGoal({ ...goal, targetLow: e.target.value })} />
                <input type="number" step="0.1" placeholder={t("health.to")} aria-label={t("health.to")} value={goal.targetHigh ?? ""} onChange={(e) => setGoal({ ...goal, targetHigh: e.target.value })} />
                <select value={goal.direction || "keep"} onChange={(e) => setGoal({ ...goal, direction: e.target.value })} aria-label={t("health.direction")}><option value="down">{t("health.dir.down")}</option><option value="up">{t("health.dir.up")}</option><option value="keep">{t("health.dir.keep")}</option></select>
                {d.subject.isChild ? <select value={goal.visibility || "trend"} onChange={(e) => setGoal({ ...goal, visibility: e.target.value })} aria-label={t("health.visibility")}><option value="number">{t("health.vis.number")}</option><option value="trend">{t("health.vis.trend")}</option></select> : <span className="hidden sm:block" />}
                <input className="col-span-2 sm:col-span-3" placeholder={t("health.doctorNote")} value={goal.note || ""} onChange={(e) => setGoal({ ...goal, note: e.target.value })} />
                <button className="btn-ghost col-span-2 sm:col-span-1">{t("common.save")}</button>
              </form>
            </Card>
            <Card title={t("health.scale")} className="lg:col-span-2">
              {d.scale ? (
                <>
                  <div className="text-xs text-muted">{t("health.scaleUrl")}</div>
                  <code dir="ltr" className="block text-[11px] sm:text-xs bg-ivory rounded-lg p-2 mt-1 break-all">POST {base}/api/scale {`{"token":"${d.scale.token}","weight_kg":62.4}`}</code>
                  <div className="text-xs text-muted mt-2">{t("health.scaleHelp")}</div>
                </>
              ) : <button className="btn-ghost btn-sm" onClick={link}>{t("health.createLink")}</button>}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
