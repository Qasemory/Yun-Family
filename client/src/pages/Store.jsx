// الصفحة العامة لمتجر «يون كروشيه» — بدون حساب، هوية مستقلة (كريمي + بني)
import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api, post } from "../lib/api.js";
import YarnIcon from "../components/YarnIcon.jsx";

export default function Store() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const lang = sp.get("lang") === "en" ? "en" : "ar";
  const ar = lang === "ar";
  const [sf, setSf] = useState(null);
  const [cat, setCat] = useState("all");
  const [order, setOrder] = useState({ firstName: "", phone: "", color: "", name: "" });
  const [done, setDone] = useState(null);
  useEffect(() => { api(`/store?lang=${lang}`, { auth: false }).then(setSf); }, [lang]);
  useEffect(() => { if (sf) document.title = `${ar ? sf.brand.fullName : sf.brand.fullNameEn} · ${ar ? sf.brand.tagline : sf.brand.taglineEn}`; }, [sf, ar]);
  if (!sf) return <div className="min-h-screen bg-shop-cream" />;
  const b = sf.brand;
  const product = slug ? sf.products.find((p) => p.slug === slug) : null;
  const cats = [["all", ar ? "الكل" : "All"], ["babies", ar ? "مواليد" : "Babies"], ["dolls", ar ? "دمى" : "Dolls"], ["bags", ar ? "حقائب" : "Bags"], ["gifts", ar ? "هدايا" : "Gifts"]];
  const list = sf.products.filter((p) => cat === "all" || p.category === cat);
  const wa = b.whatsapp ? `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(`مرحبا، حابة أطلب من ${b.name}`)}` : null;
  const submit = async (e) => { e.preventDefault(); const r = await post("/store/order", { slug: product.slug, firstName: order.firstName, phone: order.phone, options: { color: order.color, name: order.name }, lang }); setDone(r); };

  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-shop-cream text-shop-ink font-sans">
      <div className="max-w-md mx-auto px-5 pb-28">
        <header className="flex items-center justify-between pt-6">
          <Link to={`/store?lang=${lang}`} className="flex items-center gap-3">
            <YarnIcon size={40} />
            <div><div className="font-shop font-bold text-xl leading-tight text-shop-brown">{ar ? b.name : b.nameEn} <span className="font-medium text-sm opacity-80">{ar ? b.descriptor : b.descriptorEn}</span></div><div className="text-[11px] text-[#9A8273]">{ar ? "صوف بالتركية · كروشيه يدوي من عمّان" : "Turkish for “wool” · handmade crochet in Amman"}</div></div>
          </Link>
          <div className="flex gap-2">
            <a href={`https://instagram.com/${b.instagram}`} aria-label="Instagram" className="w-9 h-9 rounded-full bg-white border border-shop-line flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A3328" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></svg></a>
            <button onClick={() => setSp({ lang: ar ? "en" : "ar" })} className="rounded-full px-3 h-9 bg-white border border-shop-line text-xs font-semibold">{ar ? "EN" : "عربي"}</button>
          </div>
        </header>

        {!product ? (
          <>
            <div className="relative mt-5 h-56 rounded-3xl overflow-hidden bg-shop-sand">
              <div className="absolute inset-0 bg-gradient-to-t from-[#2B1D16]/70 via-transparent" />
              <div className="absolute bottom-5 inset-x-5 text-shop-cream">
                <h1 className="text-2xl font-semibold leading-snug">{ar ? <>صُنع <span className="text-[#F0C9C9]">بحب</span> لكة</> : <>Made with <span className="text-[#F0C9C9]">love</span>, for you</>}</h1>
                <p className="text-sm text-[#EEDFCF] font-light">{ar ? "كل قطعة بطلبك، غرزة غرزة" : "Every piece to order, stitch by stitch"}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 overflow-x-auto">
              {sf.earliestAny && <span className="whitespace-nowrap rounded-full px-3 py-2 text-[11.5px] font-medium bg-shop-night text-shop-cream">{ar ? "أقرب تسليم: " : "Earliest delivery: "}{sf.earliestAny}</span>}
              <span className="whitespace-nowrap rounded-full px-3 py-2 text-[11.5px] font-medium bg-white border border-shop-line">{ar ? "ألوان متوفرة الآن: " : "Colours in stock: "}{sf.colorsInStock}</span>
            </div>
            <div className="flex gap-4 mt-4 text-sm text-[#9A8273] overflow-x-auto">{cats.map(([k, l]) => <button key={k} onClick={() => setCat(k)} className={`pb-1 whitespace-nowrap ${cat === k ? "text-shop-ink font-semibold border-b-2 border-shop-brown" : ""}`}>{l}</button>)}</div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {list.map((p) => (
                <Link key={p._id} to={`/store/${p.slug}?lang=${lang}`} className="bg-white rounded-2xl p-2 border border-shop-line">
                  <div className="h-28 rounded-xl bg-shop-sand overflow-hidden">{p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="mt-2 font-semibold text-sm">{ar ? p.nameAr : p.nameEn || p.nameAr}</div>
                  <div className="text-[11px] text-[#9A8273]">{ar ? `حسب الطلب · ${p.days} أيام` : `Made to order · ${p.days} days`}</div>
                  <div className="text-shop-brown font-bold">{p.price} {ar ? "د.أ" : "JOD"}</div>
                </Link>
              ))}
            </div>
            <footer className="text-center text-[11px] text-[#9A8273] mt-10 leading-relaxed">{ar ? "اختر · تواصل · عربون CliQ · تسليم بمكان عام أو توصيل" : "Choose · contact · CliQ deposit · public-place handover or delivery"}<br /><span className="font-shop font-bold text-shop-brown">{ar ? b.fullName : b.fullNameEn}</span> · {ar ? b.craft : b.craftEn} · <span dir="ltr">{b.taglineTr}</span></footer>
          </>
        ) : (
          <div className="mt-5">
            <div className="h-56 rounded-3xl bg-shop-sand overflow-hidden">{product.imageUrl && <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
            <h1 className="text-2xl font-semibold mt-4">{ar ? product.nameAr : product.nameEn || product.nameAr}</h1>
            <div className="text-shop-brown font-bold text-xl">{product.price} {ar ? "د.أ" : "JOD"}</div>
            <p className="text-sm text-[#6B5A50] mt-2 leading-relaxed">{ar ? product.descAr : product.descEn || product.descAr}</p>
            <div className="flex gap-2 mt-3 text-[11.5px]"><span className="rounded-full px-3 py-2 bg-shop-night text-shop-cream">{ar ? "أقرب تسليم: " : "Earliest: "}{product.earliest}</span><span className="rounded-full px-3 py-2 bg-white border border-shop-line">{product.hours} {ar ? "ساعات عمل" : "hours of work"}</span></div>
            <div className="mt-4 text-sm font-semibold">{ar ? "الألوان المتوفرة فعلاً" : "Colours actually in stock"}</div>
            <div className="flex gap-2 mt-2 flex-wrap">{product.colors.map((c) => <button key={c.id} disabled={!c.available} onClick={() => setOrder({ ...order, color: c.color })} className={`flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs ${order.color === c.color ? "border-shop-brown bg-white" : "border-shop-line bg-white"} ${!c.available ? "opacity-40" : ""}`}><span className="w-4 h-4 rounded-full" style={{ background: c.hex }} />{c.color}{!c.available && (ar ? " · نفد" : " · out")}</button>)}</div>
            {done ? (
              <div className="mt-5 bg-white rounded-2xl p-4 border border-shop-line"><div className="font-semibold">{ar ? "وصل طلبك" : "Order received"}</div><p className="text-sm mt-1 whitespace-pre-line">{done.suggestedReply}</p>{done.whatsapp && <a className="inline-block mt-3 rounded-xl bg-shop-brown text-white px-4 py-2 text-sm" href={`https://wa.me/${done.whatsapp}`}>{ar ? "تابعي على واتساب" : "Continue on WhatsApp"}</a>}</div>
            ) : (
              <form onSubmit={submit} className="mt-5 bg-white rounded-2xl p-4 border border-shop-line flex flex-col gap-2">
                <div className="font-semibold">{ar ? "اطلبي" : "Order"}</div>
                <input required placeholder={ar ? "اسمك الأول" : "Your first name"} value={order.firstName} onChange={(e) => setOrder({ ...order, firstName: e.target.value })} className="border-shop-line" />
                <input placeholder={ar ? "رقم واتساب" : "WhatsApp number"} value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} className="border-shop-line" dir="ltr" />
                <input placeholder={ar ? "اسم للنقش أو الإهداء (اختياري)" : "Name to embroider or gift to (optional)"} value={order.name} onChange={(e) => setOrder({ ...order, name: e.target.value })} className="border-shop-line" />
                <button className="rounded-xl bg-shop-brown text-white h-11 font-semibold">{ar ? "أرسلي الطلب" : "Send order"}</button>
                <div className="text-[11px] text-[#9A8273] text-center">{ar ? "عربون ٣٥٪ عبر CliQ · تسليم بمكان عام أو توصيل" : "35% CliQ deposit · public-place handover or delivery"}<br />{ar ? b.craft : b.craftEn}</div>
              </form>
            )}
            <Link to={`/store?lang=${lang}`} className="block text-center text-xs text-[#9A8273] mt-6">{ar ? "← كل المنتجات" : "All products"}</Link>
          </div>
        )}
        {wa && !product && <a href={wa} className="fixed bottom-5 inset-x-5 max-w-md mx-auto rounded-2xl bg-shop-night text-shop-cream text-center py-4 font-semibold">{ar ? "اطلب على واتساب" : "Order on WhatsApp"}</a>}
      </div>
    </div>
  );
}
