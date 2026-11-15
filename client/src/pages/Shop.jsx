// إدارة المتجر (رنا): الطلبات، الكتالوج، الخيوط، المالية، الهوية
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post, patch } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { Card, Spinner, Stat, Msg, PageTitle } from "../components/ui.jsx";

const COLS = ["new", "accepted", "in_progress", "ready", "delivered"];
const NEXT = { new: "accepted", accepted: "in_progress", in_progress: "ready", ready: "delivered" };
const CATS = ["babies", "dolls", "bags", "gifts"];

export default function Shop() {
  const { t, lang } = useT();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("orders");
  const [msg, setMsg] = useState(null);
  const [np, setNp] = useState({ nameAr: "", nameEn: "", price: "", hours: 4, days: 5, category: "gifts" });
  const [ny, setNy] = useState({ color: "", hex: "#D9B28F", grams: 100 });
  const [brand, setBrand] = useState({});
  const load = () => get("/shop").then((r) => { setD(r); setBrand({ shop_name: r.brand.name, shop_name_en: r.brand.nameEn, shop_instagram: r.brand.instagram, shop_whatsapp: r.brand.whatsapp, protected_hours_week: r.finance.protectedHours }); });
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const pname = (p) => (lang === "en" ? p?.nameEn || p?.nameAr : p?.nameAr) || "";
  const move = async (o, status) => { await patch(`/shop/order/${o._id}`, { status }); load(); };
  const addP = async (e) => { e.preventDefault(); await post("/shop/product", np); setNp({ nameAr: "", nameEn: "", price: "", hours: 4, days: 5, category: "gifts" }); load(); };
  const addY = async (e) => { e.preventDefault(); await post("/shop/yarn", ny); setNy({ color: "", hex: "#D9B28F", grams: 100 }); load(); };
  const saveBrand = async (e) => { e.preventDefault(); await post("/shop/brand", brand); setMsg({ kind: "ok", text: t("shop.brandSaved") }); load(); };
  const caption = async (p) => { const c = await get(`/shop/caption/${p._id}`); await navigator.clipboard?.writeText(c.ar + "\n\n" + c.en); setMsg({ kind: "ok", text: t("shop.captionCopied") }); };
  return (
    <div className="flex flex-col gap-4">
      <div><PageTitle>{lang === "en" ? d.brand.fullNameEn || d.brand.fullName : d.brand.fullName}</PageTitle><div className="text-xs text-muted">{lang === "en" ? d.brand.taglineEn || d.brand.tagline : d.brand.tagline} · <a className="underline" href="/" target="_blank" rel="noreferrer">{t("shop.publicPage")}</a></div></div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl"><Stat label={t("shop.monthSales")} value={`${d.finance.monthRevenue} ${t("shop.jodShort")}`} /><Stat label={t("shop.delivered")} value={d.finance.monthOrders} /><Stat label={t("shop.openHours")} value={d.finance.openHours} sub={t("shop.protected", { n: d.finance.protectedHours })} /></div>
      {d.finance.openHours > d.finance.protectedHours * 2 && <Msg kind="warn">{t("shop.timeGuard")}</Msg>}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">{["orders", "catalog", "yarn", "brand"].map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`pill whitespace-nowrap ${tab === k ? "bg-olive text-white border-transparent" : ""}`}>{t(`shop.tab.${k}`)}</button>)}</div>

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
                    {k === "ready" && <Link to={fam(`/gift/${o._id}`)} target="_blank" className="btn-ghost btn-sm mt-2 inline-flex">{t("shop.giftCard")}</Link>}
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "catalog" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-start">
          {d.products.map((p) => (
            <Card key={p._id} title={`${pname(p)} · ${p.price} ${t("shop.jodShort")}`} right={<span className={`pill ${p.active ? "pill-green" : ""}`}>{p.active ? t("shop.visible") : t("shop.hidden")}</span>}>
              <div className="text-xs text-muted">{t("shop.hoursDays", { h: p.hours, d: p.days })} · <span dir="ltr">/p/{p.slug}</span></div>
              <div className="flex flex-wrap gap-2 mt-2"><button className="btn-ghost btn-sm" onClick={() => caption(p)}>{t("shop.instaCaption")}</button><button className="btn-ghost btn-sm" onClick={async () => { await patch(`/shop/product/${p._id}`, { active: !p.active }); load(); }}>{p.active ? t("shop.hide") : t("shop.show")}</button></div>
            </Card>
          ))}
          <Card title={t("shop.newProduct")} className="md:col-span-2 xl:col-span-3">
            <form onSubmit={addP} className="grid gap-2 sm:grid-cols-2">
              <input placeholder="الاسم بالعربي" dir="rtl" lang="ar" value={np.nameAr} onChange={(e) => setNp({ ...np, nameAr: e.target.value })} required />
              <input placeholder="Name in English" dir="ltr" lang="en" value={np.nameEn} onChange={(e) => setNp({ ...np, nameEn: e.target.value })} />
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
