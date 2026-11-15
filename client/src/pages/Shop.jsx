// إدارة المتجر (رنا): الطلبات، الكتالوج، الخيوط، المالية، الهوية
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post, patch, imgSrc } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Card, Spinner, Stat, Msg, PageTitle } from "../components/ui.jsx";
import { shrinkImage } from "../lib/image.js";

// رد واتساب جاهز لطلب (Claude)
function WaReply({ order }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [m, setM] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const gen = async () => { setBusy(true); setErr(""); try { setOut(await post(`/shop/ai/reply/${order._id}`, { message: m })); } catch { setErr(t("ai.failed")); } setBusy(false); };
  if (!open) return <button className="btn-ghost btn-sm mt-2" onClick={() => setOpen(true)}>{t("shop.waReply")}</button>;
  return (
    <div className="mt-2 flex flex-col gap-2 bg-ivory rounded-xl p-2">
      <textarea className="h-16 py-1.5 text-sm" dir="auto" placeholder={t("shop.customerMsgPh")} value={m} onChange={(e) => setM(e.target.value)} />
      <button className="btn btn-sm self-start" onClick={gen} disabled={busy}>{busy ? "…" : t("shop.generate")}</button>
      {err && <Msg kind="err">{err}</Msg>}
      {out && <>
        <textarea className="h-28 py-1.5 text-sm" dir="auto" value={out.text} onChange={(e) => setOut({ ...out, text: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={async () => { await navigator.clipboard?.writeText(out.text); setCopied(true); }}>{copied ? t("shop.copied") : t("shop.copy")}</button>
          {out.phone && <a className="btn btn-sm" href={`https://wa.me/${out.phone}?text=${encodeURIComponent(out.text)}`} target="_blank" rel="noreferrer">{t("shop.openWa")}</a>}
        </div>
      </>}
    </div>
  );
}

// مشاريع الكروشيه: عدّاد صفوف كبير + مؤقّت شغل
function Projects({ orders }) {
  const { t } = useT();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ title: "", rowsTarget: "", order: "" });
  const [now, setNow] = useState(Date.now());
  const load = () => get("/shop/projects").then(setList);
  useEffect(() => { load(); const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const act = async (p, a, body) => { const r = await post(`/shop/projects/${p._id}/${a}`, body || {}); if (a === "delete") return load(); setList((l) => l.map((x) => (x._id === p._id ? { ...x, ...r } : x))); };
  const add = async (e) => { e.preventDefault(); if (!f.title.trim()) return; await post("/shop/projects", { ...f, order: f.order || undefined }); setF({ title: "", rowsTarget: "", order: "" }); load(); };
  if (!list) return <Spinner />;
  const mins = (p) => p.minutes + (p.timerStartedAt ? Math.floor((now - new Date(p.timerStartedAt).getTime()) / 60000) : 0);
  const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const open = orders.filter((o) => ["accepted", "in_progress"].includes(o.status));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-start">
      {list.map((p) => (
        <Card key={p._id} title={<span dir="auto">{p.title}</span>} right={p.status === "done" ? <span className="pill pill-green">{t("proj.done")}</span> : p.timerStartedAt ? <span className="pill pill-gold">⏱ {t("proj.running")}</span> : null} className={p.status === "done" ? "opacity-70" : ""}>
          {p.order && <div className="text-xs text-muted mb-2">{t("proj.forOrder", { name: p.order.customerName || "" })} · <span dir="ltr">{p.order.due}</span></div>}
          <div className="flex items-center justify-center gap-4 my-2">
            <button className="btn-ghost w-14 h-14 text-2xl rounded-full" onClick={() => act(p, "row", { by: -1 })} aria-label={t("proj.minus")} disabled={p.status === "done"}>−</button>
            <div className="text-center"><div className="text-5xl font-bold text-olive tabular-nums" dir="ltr">{p.rows}</div><div className="text-xs text-muted">{p.rowsTarget ? t("proj.ofRows", { n: p.rowsTarget }) : t("proj.rows")}</div></div>
            <button className="btn w-16 h-16 text-3xl rounded-full" onClick={() => act(p, "row")} aria-label={t("proj.plus")} disabled={p.status === "done"}>+</button>
          </div>
          {p.rowsTarget > 0 && <div className="h-1.5 bg-ivory rounded-full overflow-hidden" dir="ltr"><div className="h-full bg-olive" style={{ width: `${Math.min(100, (100 * p.rows) / p.rowsTarget)}%` }} /></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
            <span className="text-sm">⏱ <b dir="ltr">{hm(mins(p))}</b> <span className="text-xs text-muted">{t("proj.hours")}</span></span>
            <div className="flex gap-1">
              {p.status !== "done" && (p.timerStartedAt ? <button className="btn-ghost btn-sm" onClick={() => act(p, "stop")}>⏸ {t("proj.stop")}</button> : <button className="btn-ghost btn-sm" onClick={() => act(p, "start")}>▶ {t("proj.start")}</button>)}
              {p.status !== "done" ? <button className="btn-ghost btn-sm" onClick={() => act(p, "done")}>✓ {t("proj.finish")}</button> : <button className="btn-ghost btn-sm" onClick={() => act(p, "reopen")}>{t("proj.reopen")}</button>}
              <button className="btn-ghost btn-sm" aria-label={t("common.delete")} onClick={() => window.confirm(t("tasks.confirmDelete", { title: p.title })) && act(p, "delete")}>🗑</button>
            </div>
          </div>
          <textarea className="w-full h-16 py-1.5 text-sm mt-2" placeholder={t("proj.notesPh")} defaultValue={p.notes || ""} onBlur={(e) => e.target.value !== (p.notes || "") && act(p, "update", { notes: e.target.value })} />
        </Card>
      ))}
      <Card title={t("proj.new")}>
        <form onSubmit={add} className="flex flex-col gap-2">
          <input placeholder={t("proj.titlePh")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} />
          <input type="number" min="0" inputMode="numeric" placeholder={t("proj.targetPh")} value={f.rowsTarget} onChange={(e) => setF({ ...f, rowsTarget: e.target.value })} />
          {open.length > 0 && <select value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} aria-label={t("proj.linkOrder")}><option value="">{t("proj.noOrder")}</option>{open.map((o) => <option key={o._id} value={o._id}>{o.customerName} · {o.product?.nameAr}</option>)}</select>}
          <button className="btn" disabled={!f.title.trim()}>{t("common.add")}</button>
        </form>
      </Card>
    </div>
  );
}

const COLS = ["new", "accepted", "in_progress", "ready", "delivered"];
const NEXT = { new: "accepted", accepted: "in_progress", in_progress: "ready", ready: "delivered" };
const CATS = ["babies", "dolls", "bags", "gifts"];

export default function Shop() {
  const { t, lang } = useT();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("orders");
  const [msg, setMsg] = useState(null);
  const EMPTY_P = { nameAr: "", nameEn: "", descAr: "", descEn: "", price: "", hours: 4, days: 5, category: "gifts" };
  const [np, setNp] = useState(EMPTY_P);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const photoRef = useRef(null);
  const [ny, setNy] = useState({ color: "", hex: "#D9B28F", grams: 100 });
  const [brand, setBrand] = useState({});
  const load = () => get("/shop").then((r) => { setD(r); setBrand({ shop_name: r.brand.name, shop_name_en: r.brand.nameEn, shop_instagram: r.brand.instagram, shop_whatsapp: r.brand.whatsapp, protected_hours_week: r.finance.protectedHours }); });
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const pname = (p) => (lang === "en" ? p?.nameEn || p?.nameAr : p?.nameAr) || "";
  const move = async (o, status) => { await patch(`/shop/order/${o._id}`, { status }); load(); };
  const addP = async (e) => {
    e.preventDefault();
    try { await post("/shop/product", { ...np, image: photo || undefined }); setNp(EMPTY_P); setNotes(""); setPhoto(null); load(); }
    catch { setMsg({ kind: "err", text: t("common.notSaved") }); }
  };
  const changePhoto = async (p, file) => { try { await patch(`/shop/product/${p._id}`, { image: await shrinkImage(file, 1280, 0.82) }); load(); } catch { setMsg({ kind: "err", text: t("common.badImage") }); } };
  const pickPhoto = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setPhoto(await shrinkImage(f, 1280, 0.82)); } catch { /* ignore */ } } };
  const describe = async () => {
    setAiBusy(true); setMsg(null);
    try {
      const r = await post("/shop/ai/describe", { nameAr: np.nameAr, nameEn: np.nameEn, notes, image: photo || undefined });
      setNp((p) => ({ ...p, nameAr: r.nameAr || p.nameAr, nameEn: r.nameEn || p.nameEn, descAr: r.descAr, descEn: r.descEn, category: r.category || p.category, hours: r.hours || p.hours }));
      setMsg({ kind: "ok", text: t("shop.aiFilled") });
    } catch { setMsg({ kind: "err", text: t("ai.failed") }); }
    setAiBusy(false);
  };
  const addY = async (e) => { e.preventDefault(); await post("/shop/yarn", ny); setNy({ color: "", hex: "#D9B28F", grams: 100 }); load(); };
  const saveBrand = async (e) => { e.preventDefault(); await post("/shop/brand", brand); setMsg({ kind: "ok", text: t("shop.brandSaved") }); load(); };
  const caption = async (p) => { const c = await get(`/shop/caption/${p._id}`); await navigator.clipboard?.writeText(c.ar + "\n\n" + c.en); setMsg({ kind: "ok", text: t("shop.captionCopied") }); };
  return (
    <div className="flex flex-col gap-4">
      <div><PageTitle>{lang === "en" ? d.brand.fullNameEn || d.brand.fullName : d.brand.fullName}</PageTitle><div className="text-xs text-muted">{lang === "en" ? d.brand.taglineEn || d.brand.tagline : d.brand.tagline} · <a className="underline" href="/" target="_blank" rel="noreferrer">{t("shop.publicPage")}</a></div></div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl"><Stat label={t("shop.monthSales")} value={`${d.finance.monthRevenue} ${t("shop.jodShort")}`} /><Stat label={t("shop.delivered")} value={d.finance.monthOrders} /><Stat label={t("shop.openHours")} value={d.finance.openHours} sub={t("shop.protected", { n: d.finance.protectedHours })} /></div>
      {d.finance.openHours > d.finance.protectedHours * 2 && <Msg kind="warn">{t("shop.timeGuard")}</Msg>}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">{["orders", "projects", "catalog", "yarn", "brand"].map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`pill whitespace-nowrap ${tab === k ? "bg-olive text-white border-transparent" : ""}`}>{t(`shop.tab.${k}`)}</button>)}</div>

      {tab === "orders" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-start">
          {COLS.map((k) => {
            const rows = d.orders.filter((o) => o.status === k);
            return (
              <Card key={k} title={`${t(`shop.status.${k}`)} · ${rows.length}`}>
                {rows.length === 0 && <div className="text-xs text-muted">—</div>}
                {rows.map((o) => (
                  <div key={o._id} className="py-2 border-b border-line last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0"><div className="font-semibold text-sm">{pname(o.product)} · {o.customerName}</div><div className="text-xs text-muted">{o.options?.color ? `${t("shop.color")}: ${o.options.color} · ` : ""}{o.options?.name ? `${t("shop.engrave")}: ${o.options.name} · ` : ""}{t("shop.due")} <span dir="ltr">{o.due}</span> · {o.price} {t("shop.jodShort")}</div></div>
                      <div className="flex gap-1 shrink-0">{NEXT[k] && <button className="btn btn-sm" onClick={() => move(o, NEXT[k])}>{t("shop.moveTo", { s: t(`shop.status.${NEXT[k]}`) })}</button>}{k === "new" && <button className="btn-ghost btn-sm" aria-label={t("shop.decline")} title={t("shop.decline")} onClick={() => move(o, "declined")}>✗</button>}</div>
                    </div>
                    {d.ai && <WaReply order={o} />}
                    {k === "ready" && <Link to={fam(`/gift/${o._id}`)} target="_blank" className="btn-ghost btn-sm mt-2 inline-flex">{t("shop.giftCard")}</Link>}
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "projects" && <Projects orders={d.orders} />}

      {tab === "catalog" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-start">
          {d.products.map((p) => (
            <Card key={p._id} title={`${pname(p)} · ${p.price} ${t("shop.jodShort")}`} right={<span className={`pill ${p.active ? "pill-green" : ""}`}>{p.active ? t("shop.visible") : t("shop.hidden")}</span>}>
              <div className="flex gap-3">
                <label className="w-20 h-20 shrink-0 rounded-xl bg-shop-sand overflow-hidden cursor-pointer relative" title={t("shop.changePhoto")}>
                  {p.imageUrl ? <img src={imgSrc(p.imageUrl)} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="absolute inset-0 flex items-center justify-center text-2xl">📷</span>}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) changePhoto(p, f); }} aria-label={t("shop.changePhoto")} />
                </label>
                <div className="text-xs text-muted min-w-0">{t("shop.hoursDays", { h: p.hours, d: p.days })} · <span dir="ltr">/p/{p.slug}</span><div className="mt-1">{p.imageUrl ? t("shop.tapToChange") : t("shop.addPhoto")}</div></div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2"><button className="btn-ghost btn-sm" onClick={() => caption(p)}>{t("shop.instaCaption")}</button><button className="btn-ghost btn-sm" onClick={async () => { await patch(`/shop/product/${p._id}`, { active: !p.active }); load(); }}>{p.active ? t("shop.hide") : t("shop.show")}</button></div>
            </Card>
          ))}
          <Card title={t("shop.newProduct")} className="md:col-span-2 xl:col-span-3">
            <form onSubmit={addP} className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-col gap-2 bg-ivory rounded-xl p-2">
                {d.ai && <textarea className="h-16 py-1.5 text-sm" placeholder={t("shop.notesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} />}
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => photoRef.current?.click()}>{photo ? t("shop.photoAttached") : t("shop.aiPhoto")}</button>
                  {photo && <img src={photo} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                  {d.ai && <button type="button" className="btn btn-sm" onClick={describe} disabled={aiBusy || (!photo && !notes && !np.nameAr && !np.nameEn)}>{aiBusy ? "…" : t("shop.aiWrite")}</button>}
                </div>
                <div className="text-xs text-muted">{d.ai ? t("shop.photoSaved") : `${t("shop.photoSaved")} ${t("ai.off")}`}</div>
                {aiBusy && <div className="text-xs text-muted">{t("ai.working")}</div>}
              </div>
              <input placeholder="الاسم بالعربي" dir="rtl" lang="ar" value={np.nameAr} onChange={(e) => setNp({ ...np, nameAr: e.target.value })} required />
              <input placeholder="Name in English" dir="ltr" lang="en" value={np.nameEn} onChange={(e) => setNp({ ...np, nameEn: e.target.value })} />
              <textarea className="h-24 py-2" placeholder="الوصف بالعربي" dir="rtl" lang="ar" value={np.descAr} onChange={(e) => setNp({ ...np, descAr: e.target.value })} />
              <textarea className="h-24 py-2" placeholder="Description in English" dir="ltr" lang="en" value={np.descEn} onChange={(e) => setNp({ ...np, descEn: e.target.value })} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:col-span-2">
                <input type="number" inputMode="decimal" placeholder={t("shop.price")} aria-label={t("shop.price")} value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required />
                <input type="number" inputMode="numeric" placeholder={t("shop.hours")} aria-label={t("shop.hours")} value={np.hours} onChange={(e) => setNp({ ...np, hours: e.target.value })} />
                <input type="number" inputMode="numeric" placeholder={t("shop.days")} aria-label={t("shop.days")} value={np.days} onChange={(e) => setNp({ ...np, days: e.target.value })} />
                <select value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} aria-label={t("shop.category")}>{CATS.map((c) => <option key={c} value={c}>{t(`shop.cat.${c}`)}</option>)}</select>
              </div>
              <div className="text-xs text-muted sm:col-span-2">{t("shop.priceHint", { rate: 4 })}</div>
              <button className="btn sm:col-span-2 sm:justify-self-start">{t("common.add")}</button>
            </form>
          </Card>
        </div>
      )}

      {tab === "yarn" && (
        <Card title={t("shop.yarnStock")} className="max-w-3xl">
          {d.yarn.map((y) => <div key={y._id} className="row"><div className="flex items-center gap-2 min-w-0"><span className="w-5 h-5 shrink-0 rounded-full border border-line" style={{ background: y.hex }} /><span className="truncate">{y.color}</span></div><div className="flex items-center gap-2"><span className={`text-sm ${y.grams < 50 ? "text-[#8A3B12] font-semibold" : ""}`}>{t("shop.grams", { n: y.grams })}</span><button className="btn-ghost btn-sm" onClick={async () => { const g = window.prompt(t("shop.newGrams"), y.grams); if (g != null) { await patch(`/shop/yarn/${y._id}`, { grams: Number(g) }); load(); } }}>{t("common.edit")}</button></div></div>)}
          <form onSubmit={addY} className="grid grid-cols-[1fr_auto_5.5rem] sm:grid-cols-[1fr_auto_6rem_auto] gap-2 mt-3">
            <input placeholder={t("shop.colorName")} aria-label={t("shop.colorName")} value={ny.color} onChange={(e) => setNy({ ...ny, color: e.target.value })} required />
            <input type="color" className="w-14" aria-label={t("shop.color")} value={ny.hex} onChange={(e) => setNy({ ...ny, hex: e.target.value })} />
            <input type="number" inputMode="numeric" aria-label={t("shop.gramsLabel")} value={ny.grams} onChange={(e) => setNy({ ...ny, grams: e.target.value })} />
            <button className="btn-ghost col-span-3 sm:col-span-1">{t("common.add")}</button>
          </form>
          <div className="text-xs text-muted mt-2">{t("shop.yarnHint")}</div>
        </Card>
      )}

      {tab === "brand" && (
        <Card title={t("shop.brand")} className="max-w-2xl">
          <form onSubmit={saveBrand} className="flex flex-col gap-2">
            <div className="grid sm:grid-cols-2 gap-2"><input placeholder="الاسم" dir="rtl" lang="ar" value={brand.shop_name || ""} onChange={(e) => setBrand({ ...brand, shop_name: e.target.value })} /><input placeholder="Name" dir="ltr" lang="en" value={brand.shop_name_en || ""} onChange={(e) => setBrand({ ...brand, shop_name_en: e.target.value })} /></div>
            <input placeholder={t("shop.instagramPh")} dir="ltr" value={brand.shop_instagram || ""} onChange={(e) => setBrand({ ...brand, shop_instagram: e.target.value })} />
            <input placeholder={t("shop.whatsappPh")} dir="ltr" inputMode="tel" value={brand.shop_whatsapp || ""} onChange={(e) => setBrand({ ...brand, shop_whatsapp: e.target.value })} />
            <label className="text-xs text-muted">{t("shop.protectedHours")}<input type="number" className="w-full mt-1" value={brand.protected_hours_week || 8} onChange={(e) => setBrand({ ...brand, protected_hours_week: e.target.value })} /></label>
            <button className="btn sm:self-start">{t("common.save")}</button>
          </form>
        </Card>
      )}
    </div>
  );
}
