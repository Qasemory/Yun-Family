// إدارة المتجر (رنا): الطلبات، الكتالوج، الخيوط، المالية، الهوية
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post, patch } from "../lib/api.js";
import { Card, Spinner, Stat, Msg } from "../components/ui.jsx";

const COLS = [["new", "جديد"], ["accepted", "مقبول"], ["in_progress", "قيد العمل"], ["ready", "جاهز"], ["delivered", "سُلّم"]];
const NEXT = { new: "accepted", accepted: "in_progress", in_progress: "ready", ready: "delivered" };

export default function Shop() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("orders");
  const [msg, setMsg] = useState(null);
  const [np, setNp] = useState({ nameAr: "", nameEn: "", price: "", hours: 4, days: 5, category: "gifts" });
  const [ny, setNy] = useState({ color: "", hex: "#D9B28F", grams: 100 });
  const [brand, setBrand] = useState({});
  const load = () => get("/shop").then((r) => { setD(r); setBrand({ shop_name: r.brand.name, shop_name_en: r.brand.nameEn, shop_instagram: r.brand.instagram, shop_whatsapp: r.brand.whatsapp, protected_hours_week: r.finance.protectedHours }); });
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const move = async (o, status) => { await patch(`/shop/order/${o._id}`, { status }); load(); };
  const addP = async (e) => { e.preventDefault(); await post("/shop/product", np); setNp({ nameAr: "", nameEn: "", price: "", hours: 4, days: 5, category: "gifts" }); load(); };
  const addY = async (e) => { e.preventDefault(); await post("/shop/yarn", ny); setNy({ color: "", hex: "#D9B28F", grams: 100 }); load(); };
  const saveBrand = async (e) => { e.preventDefault(); await post("/shop/brand", brand); setMsg({ kind: "ok", text: "حُفظت الهوية" }); load(); };
  const caption = async (p) => { const c = await get(`/shop/caption/${p._id}`); await navigator.clipboard?.writeText(c.ar + "\n\n" + c.en); setMsg({ kind: "ok", text: "نُسخ وصف إنستغرام" }); };
  return (
    <div className="flex flex-col gap-4">
      <div><div className="text-xl font-semibold">{d.brand.fullName}</div><div className="text-xs text-muted">{d.brand.tagline} · <a className="underline" href="/store" target="_blank" rel="noreferrer">الصفحة العامة</a></div></div>
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      <div className="grid grid-cols-3 gap-2"><Stat label="مبيعات الشهر" value={`${d.finance.monthRevenue} د`} /><Stat label="طلبات سُلّمت" value={d.finance.monthOrders} /><Stat label="ساعات مفتوحة" value={d.finance.openHours} sub={`محمي ${d.finance.protectedHours}/أسبوع`} /></div>
      {d.finance.openHours > d.finance.protectedHours * 2 && <Msg kind="warn">حارس الوقت: الطلبات المفتوحة أكثر من أسبوعين عمل. أجّلي مواعيد التسليم الجديدة.</Msg>}
      <div className="flex gap-2 overflow-x-auto">{[["orders", "الطلبات"], ["catalog", "الكتالوج"], ["yarn", "الخيوط"], ["brand", "الهوية"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`pill ${tab === k ? "bg-olive text-white border-transparent" : ""}`}>{l}</button>)}</div>

      {tab === "orders" && COLS.map(([k, l]) => {
        const rows = d.orders.filter((o) => o.status === k);
        return (
          <Card key={k} title={`${l} · ${rows.length}`}>
            {rows.length === 0 && <div className="text-xs text-muted">—</div>}
            {rows.map((o) => (
              <div key={o._id} className="py-2 border-b border-line last:border-0">
                <div className="flex items-center justify-between"><div><div className="font-semibold text-sm">{o.product?.nameAr} · {o.customerName}</div><div className="text-xs text-muted">{o.options?.color ? `لون: ${o.options.color} · ` : ""}{o.options?.name ? `نقش: ${o.options.name} · ` : ""}تسليم {o.due} · {o.price} د</div></div>
                  <div className="flex gap-1">{NEXT[k] && <button className="btn btn-sm" onClick={() => move(o, NEXT[k])}>→ {COLS.find((c) => c[0] === NEXT[k])[1]}</button>}{k === "new" && <button className="btn-ghost btn-sm" onClick={() => move(o, "declined")}>✗</button>}</div></div>
                {k === "ready" && <Link to={`/gift/${o._id}`} target="_blank" className="btn-ghost btn-sm mt-2 inline-flex">بطاقة الهدية</Link>}
              </div>
            ))}
          </Card>
        );
      })}

      {tab === "catalog" && (
        <>
          {d.products.map((p) => (
            <Card key={p._id} title={`${p.nameAr} · ${p.price} د`} right={<span className={`pill ${p.active ? "pill-green" : ""}`}>{p.active ? "ظاهر" : "مخفي"}</span>}>
              <div className="text-xs text-muted">{p.hours} ساعات · {p.days} أيام · /store/{p.slug}</div>
              <div className="flex gap-2 mt-2"><button className="btn-ghost btn-sm" onClick={() => caption(p)}>وصف إنستغرام</button><button className="btn-ghost btn-sm" onClick={async () => { await patch(`/shop/product/${p._id}`, { active: !p.active }); load(); }}>{p.active ? "إخفاء" : "إظهار"}</button></div>
            </Card>
          ))}
          <Card title="منتج جديد">
            <form onSubmit={addP} className="flex flex-col gap-2">
              <input placeholder="الاسم بالعربي" value={np.nameAr} onChange={(e) => setNp({ ...np, nameAr: e.target.value })} required /><input placeholder="Name in English" dir="ltr" value={np.nameEn} onChange={(e) => setNp({ ...np, nameEn: e.target.value })} />
              <div className="flex gap-2"><input className="w-24" type="number" placeholder="السعر" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required /><input className="w-24" type="number" placeholder="ساعات" value={np.hours} onChange={(e) => setNp({ ...np, hours: e.target.value })} /><input className="w-24" type="number" placeholder="أيام" value={np.days} onChange={(e) => setNp({ ...np, days: e.target.value })} /><select value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })}>{["babies", "dolls", "bags", "gifts"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="text-xs text-muted">السعر المقترح: (الساعات × {4} د) + الخامة + ٥٪.</div>
              <button className="btn">أضف</button>
            </form>
          </Card>
        </>
      )}

      {tab === "yarn" && (
        <Card title="مخزون الخيوط">
          {d.yarn.map((y) => <div key={y._id} className="flex items-center justify-between py-2 border-b border-line last:border-0"><div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full border border-line" style={{ background: y.hex }} />{y.color}</div><div className="flex items-center gap-2"><span className={`text-sm ${y.grams < 50 ? "text-[#8A3B12] font-semibold" : ""}`}>{y.grams} غ</span><button className="btn-ghost btn-sm" onClick={async () => { const g = window.prompt("الغرامات الجديدة", y.grams); if (g != null) { await patch(`/shop/yarn/${y._id}`, { grams: Number(g) }); load(); } }}>عدّل</button></div></div>)}
          <form onSubmit={addY} className="flex gap-2 mt-3"><input className="flex-1" placeholder="اسم اللون" value={ny.color} onChange={(e) => setNy({ ...ny, color: e.target.value })} required /><input type="color" className="w-14 p-1" value={ny.hex} onChange={(e) => setNy({ ...ny, hex: e.target.value })} /><input className="w-20" type="number" value={ny.grams} onChange={(e) => setNy({ ...ny, grams: e.target.value })} /><button className="btn-ghost">أضف</button></form>
          <div className="text-xs text-muted mt-2">أقل من ٥٠ غ = اللون يظهر «نفد» في الصفحة العامة.</div>
        </Card>
      )}

      {tab === "brand" && (
        <Card title="هوية المتجر">
          <form onSubmit={saveBrand} className="flex flex-col gap-2">
            <div className="flex gap-2"><input placeholder="الاسم" value={brand.shop_name || ""} onChange={(e) => setBrand({ ...brand, shop_name: e.target.value })} /><input placeholder="Name" dir="ltr" value={brand.shop_name_en || ""} onChange={(e) => setBrand({ ...brand, shop_name_en: e.target.value })} /></div>
            <input placeholder="معرّف إنستغرام (yun.jo)" dir="ltr" value={brand.shop_instagram || ""} onChange={(e) => setBrand({ ...brand, shop_instagram: e.target.value })} />
            <input placeholder="واتساب بصيغة دولية 9627xxxxxxxx" dir="ltr" value={brand.shop_whatsapp || ""} onChange={(e) => setBrand({ ...brand, shop_whatsapp: e.target.value })} />
            <label className="text-xs text-muted">الساعات المحمية أسبوعياً (حارس الوقت)<input type="number" className="w-full mt-1" value={brand.protected_hours_week || 8} onChange={(e) => setBrand({ ...brand, protected_hours_week: e.target.value })} /></label>
            <button className="btn">حفظ</button>
          </form>
        </Card>
      )}
    </div>
  );
}
