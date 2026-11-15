// تفعيل إشعارات الموبايل: بطاقة بالإعدادات + تذكير لطيف بالرئيسية
import { useEffect, useState } from "react";
import { get, post } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Card, Msg } from "./ui.jsx";
import { pushSupported, needsHomeScreen, permission, currentSubscription, enablePush, disablePush, isIOS } from "../lib/push.js";

function useHere() {
  const [on, setOn] = useState(null);
  const check = async () => setOn(permission() === "granted" && !!(await currentSubscription().catch(() => null)));
  useEffect(() => { check(); }, []);
  return [on, check];
}

function HomeScreenSteps() {
  const { t } = useT();
  return (
    <ol className="text-sm list-decimal ps-5 flex flex-col gap-1">
      <li>{t("push.ios1")}</li><li>{t("push.ios2")}</li><li>{t("push.ios3")}</li>
    </ol>
  );
}

export function PushCard() {
  const { t, locale } = useT();
  const [here, check] = useHere();
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const loadDevices = () => get("/push/status").then((d) => setDevices(d.devices)).catch(() => {});
  useEffect(() => { loadDevices(); }, []);
  const turnOn = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await enablePush();
      if (r === "on") { setMsg({ kind: "ok", text: t("push.onNow") }); await post("/push/test"); }
      else setMsg({ kind: r === "denied" ? "err" : "warn", text: t(`push.r.${r}`) });
    } catch { setMsg({ kind: "err", text: t("common.notSaved") }); }
    await check(); await loadDevices(); setBusy(false);
  };
  const turnOff = async () => { setBusy(true); await disablePush(); await check(); await loadDevices(); setBusy(false); setMsg({ kind: "ok", text: t("push.offNow") }); };
  const test = async () => { const r = await post("/push/test"); setMsg({ kind: r.sent ? "ok" : "warn", text: r.sent ? t("push.testSent", { n: r.sent }) : t("push.noDevices") }); };
  const removeDevice = async (id) => { await post("/push/unsubscribe", { id }); await check(); loadDevices(); };
  const ios = needsHomeScreen();
  return (
    <Card title={`🔔 ${t("push.title")}`} right={<span className={`pill ${here ? "pill-green" : ""}`}>{here ? t("push.thisOn") : t("push.thisOff")}</span>}>
      <div className="text-xs text-muted mb-3">{t("push.why")}</div>
      {ios ? (
        <div className="flex flex-col gap-2"><div className="text-sm font-semibold">{t("push.iosTitle")}</div><HomeScreenSteps /></div>
      ) : !pushSupported() ? (
        <Msg kind="warn">{t("push.r.unsupported")}</Msg>
      ) : permission() === "denied" ? (
        <Msg kind="err">{t("push.blocked")}</Msg>
      ) : here ? (
        <div className="flex flex-wrap gap-2"><button className="btn-ghost btn-sm" onClick={test}>{t("push.test")}</button><button className="btn-ghost btn-sm" onClick={turnOff} disabled={busy}>{t("push.turnOff")}</button></div>
      ) : (
        <button className="btn sm:self-start" onClick={turnOn} disabled={busy}>{busy ? "…" : t("push.turnOn")}</button>
      )}
      {msg && <div className="mt-2"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
      {devices.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-muted mb-1">{t("push.devices")}</div>
          {devices.map((d) => (
            <div key={d.id} className="row text-sm">
              <span className="min-w-0">📱 {d.device || t("push.device")} <span className="text-[11px] text-muted">· {new Date(d.createdAt).toLocaleDateString(locale)}</span></span>
              <button className="text-xs text-muted underline" onClick={() => removeDevice(d.id)}>{t("common.remove")}</button>
            </div>
          ))}
        </div>
      )}
      {isIOS() && !ios && <div className="text-[11px] text-muted mt-2">{t("push.iosOk")}</div>}
    </Card>
  );
}

const DISMISS = "fa_push_prompt";
/** تذكير صغير بالرئيسية لحد ما يفعّل أو يسكّره */
export function PushPrompt() {
  const { t } = useT();
  const [here] = useHere();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS) === "1"; } catch { return false; } });
  const [state, setState] = useState("");
  if (hidden || here !== false || permission() === "denied" || (!pushSupported() && !needsHomeScreen())) return null;
  const close = () => { try { localStorage.setItem(DISMISS, "1"); } catch { /* ignore */ } setHidden(true); };
  const go = async () => {
    if (needsHomeScreen()) { setState("ios"); return; }
    const r = await enablePush().catch(() => "unsupported");
    if (r === "on") { await post("/push/test").catch(() => {}); setHidden(true); } else setState(r);
  };
  return (
    <div className="card border-olive/40 bg-[#F2F8F6]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><div className="font-semibold">🔔 {t("push.promptTitle")}</div><div className="text-xs text-muted">{t("push.promptText")}</div></div>
        <div className="flex gap-2 shrink-0"><button className="btn btn-sm" onClick={go}>{t("push.turnOn")}</button><button className="btn-ghost btn-sm" onClick={close}>{t("push.later")}</button></div>
      </div>
      {state === "ios" && <div className="mt-3"><HomeScreenSteps /></div>}
      {state && state !== "ios" && <div className="mt-2"><Msg kind="warn">{t(`push.r.${state}`)}</Msg></div>}
    </div>
  );
}
