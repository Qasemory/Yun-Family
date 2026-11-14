import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Msg, Spinner } from "../components/ui.jsx";

const STATUS = [["mosque", "بالمسجد"], ["ontime", "بوقتها"], ["late", "متأخرة"]];
export default function Prayer() {
  const { user, isParent } = useAuth();
  const [sp] = useSearchParams();
  const u = sp.get("u") || user.id;
  const self = String(u) === String(user.id);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => get(`/prayer?u=${u}`).then(setD);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const log = async (prayer, status) => { const r = await post("/prayer/log", { prayer, status }); setMsg(r.pending ? { kind: "warn", text: "الفجر ينتظر تأكيد الأهل" } : { kind: "ok", text: `+${r.points}` }); load(); };
  const dhikr = async (slot) => { const r = await post(`/prayer/dhikr/${slot}`); setMsg({ kind: "ok", text: r.already ? "مسجّلة اليوم" : `+${r.points} أذكار` }); };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between"><div className="text-xl font-semibold">صلاتي</div><span className="pill pill-gold">فجر متتالي: {d.streak}</span></div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <Card title="صلوات اليوم">
        {d.board.map((p) => (
          <div key={p.prayer} className="flex items-center justify-between py-2 border-b border-line last:border-0">
            <div className="font-semibold w-16">{p.name}</div>
            {p.status ? <span className={`pill ${p.confirmed ? "pill-green" : "pill-gold"}`}>{STATUS.find((s) => s[0] === p.status)?.[1]}{p.confirmed ? ` +${p.points}` : " · بانتظار"}</span>
              : self ? <div className="flex gap-1">{STATUS.map(([k, l]) => <button key={k} className="btn-ghost btn-sm" onClick={() => log(p.prayer, k)}>{l}</button>)}</div> : <span className="text-xs text-muted">لسا</span>}
          </div>
        ))}
        <div className="text-xs text-muted mt-2">الفجر: مسجد ٢٥ · بوقتها ١٥ · متأخرة ٥. الباقي ١٠ / ٥ / ٢. اليوم الكامل +١٠. لا عقاب أبداً.</div>
      </Card>
      {self && <Card title="الأذكار"><div className="flex gap-2">{[["morning", "الصباح"], ["evening", "المساء"], ["sleep", "النوم"]].map(([k, l]) => <button key={k} className="btn-ghost flex-1" onClick={() => dhikr(k)}>{l} +8</button>)}</div>
        <ul className="reading mt-3 text-[17px] list-disc pr-5">{d.dhikr.morning.map((x) => <li key={x}>{x}</li>)}</ul></Card>}
      <Card title="لوحة الفجر العائلية">
        {d.family.map((m) => (
          <div key={m.userId} className="flex items-center justify-between py-2 border-b border-line last:border-0">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: m.color }} />{m.name}<span className="text-xs text-muted">· سلسلة {m.streak}</span></div>
            {m.status ? (m.confirmed ? <span className="pill pill-green">{STATUS.find((s) => s[0] === m.status)?.[1]}</span>
              : isParent ? <button className="btn btn-sm" onClick={async () => { await post(`/prayer/confirm/${m.userId}`); load(); }}>أكّد الفجر</button> : <span className="pill pill-gold">بانتظار</span>) : <span className="text-xs text-muted">—</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}
