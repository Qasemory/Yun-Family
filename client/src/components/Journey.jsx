// رحلة المهام: قطار اليوم، نجوم الأسبوع، الشارات، قطار العيلة، متجر المكافآت
import { useEffect, useRef, useState } from "react";
import { post } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Card, Msg, Empty } from "./ui.jsx";

export const DOMAIN_ICON = { prayer: "🕌", quran: "📖", dhikr: "📿", study: "📚", sport: "⚽", language: "🔤", hobby: "🎨", health: "💤", home: "🏠" };

/** قطار اليوم: كل مهمة محطة، والقطار عند أول محطة ما خلصت، وآخر محطة وقت المرح */
export function DayTrain({ plan, fun, compact = false }) {
  const { t } = useT();
  const stops = plan || [];
  const firstOpen = stops.findIndex((s) => s.status !== "done");
  const at = firstOpen === -1 ? stops.length : firstOpen;           // مكان القطار
  const total = stops.length + 1;                                  // + محطة المرح
  const pct = total > 1 ? (at / (total - 1)) * 100 : 0;
  const [moving, setMoving] = useState(false);
  const prev = useRef(at);
  useEffect(() => { if (prev.current !== at) { setMoving(true); const id = setTimeout(() => setMoving(false), 1200); prev.current = at; return () => clearTimeout(id); } }, [at]);
  if (!stops.length) return compact ? null : <Empty text={t("journey.noStops")} />;
  const size = compact ? "w-7 h-7 text-sm" : "w-9 h-9 text-base";
  const doneN = stops.filter((s) => s.status === "done").length;
  return (
    <div className={compact ? "" : "card"} role="img" aria-label={t("journey.trainAria", { done: doneN, total: stops.length })}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="font-semibold">{t("journey.todayTrain")}</div>
          <span className={`pill ${fun?.unlocked ? "pill-green" : ""}`}>{fun?.unlocked ? t("journey.arrived", { n: fun.minutes }) : t("journey.stopsLeft", { n: stops.length - doneN })}</span>
        </div>
      )}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="relative pt-9" style={{ minWidth: `${total * (compact ? 30 : 40)}px` }}>
          {/* القاطرة */}
          <div className={`train-loco absolute top-0 ${moving ? "train-moving" : ""}`} style={{ insetInlineStart: `calc(${pct}% - ${pct / 100 * (compact ? 28 : 36)}px)`, width: compact ? 28 : 36 }} aria-hidden="true">
            <div className="relative text-center text-2xl leading-none"><span className="train-face">🚂</span><span className="train-smoke" /><span className="train-smoke" /></div>
          </div>
          {/* السكة */}
          <div className="absolute inset-x-3 bottom-[13px] sm:bottom-[17px] h-1 rounded-full bg-[repeating-linear-gradient(90deg,#d9d3c7_0_8px,transparent_8px_12px)]" aria-hidden="true" />
          <div className="absolute start-3 bottom-[13px] sm:bottom-[17px] h-1 rounded-full bg-olive transition-all duration-700" style={{ width: `calc(${pct}% - ${pct / 100 * 24}px)` }} aria-hidden="true" />
          <ol className="relative flex justify-between">
            {stops.map((s) => {
              const st = s.status === "done" ? "bg-olive text-white border-olive" : s.status === "pending_confirm" ? "bg-[#F6E8D2] border-gold" : "bg-white border-line";
              return (
                <li key={s._id} className="flex flex-col items-center" title={`${s.title}${s.mandatory ? ` · ${t("tasks.mandatory")}` : ""}`}>
                  <span className={`relative ${size} rounded-full border-2 flex items-center justify-center ${st} ${s.mandatory ? "ring-2 ring-offset-1 ring-gold/60" : ""}`}>
                    {s.status === "done" ? "✓" : DOMAIN_ICON[s.domainKey] || "•"}
                    {s.status === "pending_confirm" && <span className="absolute -top-1.5 -end-1.5 text-[10px]" aria-hidden="true">🟡</span>}
                  </span>
                  <span className="sr-only">{s.title}: {t(`journey.st.${s.status}`, null, s.status)}</span>
                </li>
              );
            })}
            <li className="flex flex-col items-center" title={t("common.fun")}>
              <span className={`${size} rounded-full border-2 flex items-center justify-center ${fun?.unlocked ? "bg-gold text-white border-gold" : "bg-white border-dashed border-gold"}`}>🎉</span>
              <span className="sr-only">{t("common.fun")}</span>
            </li>
          </ol>
        </div>
      </div>
      {!compact && <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted mt-2"><span><span className="inline-block w-2.5 h-2.5 rounded-full bg-olive align-middle me-1" />{t("journey.legendDone")}</span><span>🟡 {t("journey.legendWait")}</span><span><span className="inline-block w-2.5 h-2.5 rounded-full ring-2 ring-gold/60 align-middle me-1" />{t("journey.legendMust")}</span></div>}
    </div>
  );
}

/** نجوم الأسبوع + السلسلة */
export function WeekStars({ week, streak, graceLeft }) {
  const { t, locale } = useT();
  const icon = { star: "⭐", missed: "·", rest: "🌙", today: "🚂", future: "" };
  return (
    <Card title={t("journey.week")} right={<span className="pill pill-gold">🔥 {t("journey.streak", { n: streak })}</span>}>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {week.map((d) => (
          <div key={d.day} className={`rounded-xl border text-center py-2 ${d.status === "today" ? "border-olive" : "border-line"} ${d.status === "future" ? "opacity-50" : ""} ${d.status === "star" ? "bg-[#FFF7E6]" : "bg-white"}`}>
            <div className="text-[10px] sm:text-xs text-muted truncate">{new Date(d.day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</div>
            <div className="text-lg leading-7" aria-label={t(`journey.day.${d.status}`)}>{icon[d.status]}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted mt-2">{graceLeft ? t("journey.graceOk") : t("journey.graceUsed")}</div>
    </Card>
  );
}

export function Badges({ badges, fresh = [] }) {
  const { t, en } = useT();
  const got = badges.filter((b) => b.earned).length;
  return (
    <Card title={t("journey.badges")} right={<span className="pill">{got}/{badges.length}</span>}>
      <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {badges.map((b) => (
          <li key={b.key} className={`rounded-xl border px-1 py-2 text-center ${b.earned ? "border-gold/50 bg-[#FFF7E6]" : "border-line opacity-55"}`} title={en ? b.descEn : b.descAr}>
            <div className={`text-2xl ${b.earned ? "" : "grayscale"} ${fresh.includes(b.key) ? "badge-pop" : ""}`} aria-hidden="true">{b.earned ? b.icon : "🔒"}</div>
            <div className="text-[11px] font-semibold leading-tight mt-1">{en ? b.en : b.ar}</div>
            <div className="text-[10px] text-muted leading-tight mt-0.5">{en ? b.descEn : b.descAr}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** قطار العيلة: هدف شهري مشترك */
export function FamilyTrain({ family, onEdit }) {
  const { t } = useT();
  if (!family?.enabled) return onEdit ? <Card title={t("journey.familyTrain")}><div className="text-sm text-muted mb-2">{t("journey.familyOff")}</div>{onEdit}</Card> : null;
  const stations = [25, 50, 75, 100];
  return (
    <Card title={<span>🚆 {t("journey.familyTrain")}</span>} right={<span className={`pill ${family.reached ? "pill-green" : "pill-gold"}`}>{family.reached ? t("journey.familyReached") : `${family.pct}%`}</span>}>
      <div className="font-semibold" dir="auto">{family.title}</div>
      <div className="text-xs text-muted">{t("journey.familyProgress", { p: family.progress, t: family.target })}</div>
      <div className="relative mt-8 mb-2">
        <div className="h-2 rounded-full bg-ivory border border-line overflow-hidden"><div className="h-full bg-olive transition-all duration-700" style={{ width: `${family.pct}%` }} /></div>
        {stations.map((s) => <span key={s} className={`absolute -top-1 w-4 h-4 rounded-full border-2 ${family.pct >= s ? "bg-gold border-gold" : "bg-white border-line"}`} style={{ insetInlineStart: `calc(${s}% - 8px)` }} aria-hidden="true" />)}
        <span className="train-loco absolute -top-7 text-xl" style={{ insetInlineStart: `calc(${Math.min(family.pct, 100)}% - 14px)` }} aria-hidden="true"><span className="train-face">🚂</span></span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">{family.kids.map((k) => <span key={k.id} className="pill"><span className="w-2 h-2 rounded-full me-1" style={{ background: k.color }} />{k.name} · {k.points}</span>)}</div>
      {onEdit && <div className="mt-3">{onEdit}</div>}
    </Card>
  );
}

/** متجر المكافآت للولد */
export function RewardShop({ data, onChange }) {
  const { t, locale } = useT();
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  if (!data) return null;
  const reserved = data.redemptions.filter((r) => r.status === "pending").reduce((a, r) => a + r.cost, 0);
  const free = (data.balance || 0) - reserved;
  const redeem = async (rw) => {
    setBusy(rw._id); setMsg(null);
    try { await post(`/journey/rewards/${rw._id}/redeem`); setMsg({ kind: "ok", text: t("rewards.sent") }); onChange?.(); }
    catch (e) { setMsg({ kind: "err", text: t(`err.${e.message}`, null, t("common.notSaved")) }); }
    setBusy("");
  };
  return (
    <Card title={<span>🎟️ {t("rewards.title")}</span>} right={<span className="pill pill-gold">{t("rewards.tickets", { n: free })}</span>}>
      {msg && <div className="mb-2"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
      <div className="grid sm:grid-cols-2 gap-2">
        {data.rewards.map((rw) => {
          const can = free >= rw.cost;
          return (
            <div key={rw._id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <span className="text-2xl" aria-hidden="true">{rw.icon}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold" dir="auto">{rw.title}</div><div className="text-xs text-muted">{t("rewards.cost", { n: rw.cost })}{!can ? ` · ${t("rewards.need", { n: rw.cost - free })}` : ""}</div></div>
              <button className="btn btn-sm shrink-0" disabled={!can || !!busy} onClick={() => redeem(rw)}>{busy === rw._id ? "…" : t("rewards.ask")}</button>
            </div>
          );
        })}
      </div>
      {data.redemptions.length > 0 && (
        <>
          <div className="section">{t("rewards.mine")}</div>
          {data.redemptions.slice(0, 8).map((r) => (
            <div key={r._id} className="row text-sm">
              <span className="min-w-0">{r.icon} <span dir="auto">{r.title}</span> <span className="text-xs text-muted">· {new Date(r.createdAt).toLocaleDateString(locale)}</span></span>
              <span className={`pill ${r.status === "approved" ? "pill-green" : r.status === "pending" ? "pill-gold" : ""}`}>{t(`rewards.st.${r.status}`)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
