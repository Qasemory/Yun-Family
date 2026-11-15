import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Msg, PageTitle, Spinner } from "../components/ui.jsx";

const STATUS = ["mosque", "ontime", "late"];
export default function Prayer() {
  const { user, isParent } = useAuth();
  const { t } = useT();
  const [sp] = useSearchParams();
  const u = sp.get("u") || user.id;
  const self = String(u) === String(user.id);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => get(`/prayer?u=${u}`).then(setD);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const log = async (prayer, status) => { const r = await post("/prayer/log", { prayer, status }); setMsg(r.pending ? { kind: "warn", text: t("prayer.fajrPending") } : { kind: "ok", text: `+${r.points}` }); load(); };
  const dhikr = async (slot) => { const r = await post(`/prayer/dhikr/${slot}`); setMsg({ kind: "ok", text: r.already ? t("prayer.dhikrAlready") : t("prayer.dhikrPoints", { n: r.points }) }); };
  return (
    <div className="flex flex-col gap-4">
      <PageTitle right={<span className="pill pill-gold">{t("prayer.fajrStreak", { n: d.streak })}</span>}>{self ? t("nav.prayer") : t("prayer.titleOf", { name: d.family?.find((m) => String(m.userId) === String(u))?.name || "" })}</PageTitle>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card title={t("prayer.today")}>
          {d.board.map((p) => (
            <div key={p.prayer} className="row">
              <div className="font-semibold min-w-[4rem]">{p.name}</div>
              {p.status ? <span className={`pill ${p.confirmed ? "pill-green" : "pill-gold"}`}>{t(`prayer.status.${p.status}`)}{p.confirmed ? ` +${p.points}` : ` · ${t("common.waiting")}`}</span>
                : self ? <div className="flex flex-wrap gap-1">{STATUS.map((k) => <button key={k} className="btn-ghost btn-sm" onClick={() => log(p.prayer, k)}>{t(`prayer.status.${k}`)}</button>)}</div> : <span className="text-xs text-muted">{t("prayer.notYet")}</span>}
            </div>
          ))}
          <div className="text-xs text-muted mt-2">{t("prayer.rules")}</div>
        </Card>
        <div className="flex flex-col gap-4">
          {self && (
            <Card title={t("prayer.dhikr")}>
              <div className="grid grid-cols-3 gap-2">{["morning", "evening", "sleep"].map((k) => <button key={k} className="btn-ghost px-2" onClick={() => dhikr(k)}>{t(`prayer.slot.${k}`)} +8</button>)}</div>
              <ul className="reading mt-3 text-[17px] list-disc ps-5" dir="rtl" lang="ar">{d.dhikr.morning.map((x) => <li key={x}>{x}</li>)}</ul>
            </Card>
          )}
          <Card title={t("prayer.familyBoard")}>
            {d.family.map((m) => (
              <div key={m.userId} className="row">
                <div className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 shrink-0 rounded-full" style={{ background: m.color }} /><span className="truncate">{m.name}</span><span className="text-xs text-muted whitespace-nowrap">· {t("prayer.streak", { n: m.streak })}</span></div>
                {m.status ? (m.confirmed ? <span className="pill pill-green">{t(`prayer.status.${m.status}`)}</span>
                  : isParent ? <button className="btn btn-sm" onClick={async () => { await post(`/prayer/confirm/${m.userId}`); load(); }}>{t("prayer.confirmFajr")}</button> : <span className="pill pill-gold">{t("common.waiting")}</span>) : <span className="text-xs text-muted">—</span>}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
