// الصفحة العامة لمتجر «يون كروشيه» — بدون حساب، هوية مستقلة (كريمي + بني)
import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api, post } from "../lib/api.js";
import { useDocumentLang } from "../lib/i18n.js";
import YarnIcon from "../components/YarnIcon.jsx";

export default function Store() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const lang = sp.get("lang") === "en" ? "en" : "ar";
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [sf, setSf] = useState(null);
  const [err, setErr] = useState(false);
  const [cat, setCat] = useState("all");
  const [order, setOrder] = useState({ firstName: "", phone: "", color: "", name: "" });
  const [done, setDone] = useState(null);
  const [sending, setSending] = useState(false);
  useDocumentLang(lang, dir, sf ? `${ar ? sf.brand.fullName : sf.brand.fullNameEn} · ${ar ? sf.brand.tagline : sf.brand.taglineEn}` : ar ? "يون كروشيه" : "Yun Crochet");
  useEffect(() => { setErr(false); api(`/store?lang=${lang}`, { auth: false }).then(setSf).catch(() => setErr(true)); }, [lang]);
  useEffect(() => { window.scrollTo(0, 0); setDone(null); }, [slug]);

  if (err) return <div dir={dir} className="min-h-screen bg-shop-cream text-shop-ink flex items-center justify-center p-6 text-center"><div><YarnIcon size={48} /><p className="mt-4">{ar ? "المتجر بيصحى… جرّب بعد ثواني." : "The shop is waking up… try again in a few seconds."}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-shop-brown text-white px-5 h-11 font-semibold">{ar ? "إعادة المحاولة" : "Retry"}</button></div></div>;
  if (!sf) return <div className="min-h-screen bg-shop-cream flex items-center justify-center"><YarnIcon size={48} /></div>;
  const b = sf.brand;
  const product = slug ? sf.products.find((p) => p.slug === slug) : null;
  const cats = [["all", ar ? "الكل" : "All"], ["babies", ar ? "مواليد" : "Babies"], ["dolls", ar ? "دمى" : "Dolls"], ["bags", ar ? "حقائب" : "Bags"], ["gifts", ar ? "هدايا" : "Gifts"]];
  const list = sf.products.filter((p) => cat === "all" || p.category === cat);
  const wa = b.whatsapp ? `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(ar ? `مرحبا، حابة أطلب من ${b.name}` : `Hello, I'd like to order from ${b.nameEn || b.name}`)}` : null;
  const submit = async (e) => {
    e.preventDefault(); setSending(true);
    try { const r = await post("/store/order", { slug: product.slug, firstName: order.firstName, phone: order.phone, options: { color: order.color, name: order.name }, lang }); setDone(r); }
    finally { setSending(false); }
  };
  const pName = (p) => (ar ? p.nameAr : p.nameEn || p.nameAr);

  return (
    <div dir={dir} lang={lang} className="min-h-screen bg-shop-cream text-shop-ink font-sans">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-28 sm:pb-16">
        <header className="flex items-center justify-between gap-3 pt-5 sm:pt-8">
          <Link to={`/?lang=${lang}`} className="flex items-center gap-3 min-w-0">
            <YarnIcon size={40} />
            <div className="min-w-0"><div className="font-shop font-bold text-lg sm:text-xl leading-tight text-shop-brown truncate">{ar ? b.name : b.nameEn} <span className="font-medium text-sm opacity-80">{ar ? b.descriptor : b.descriptorEn}</span></div><div className="text-[11px] sm:text-xs text-[#9A8273] truncate">{ar ? "صوف بالتركية · كروشيه يدوي من عمّان" : "Turkish for “wool” · handmade crochet in Amman"}</div></div>
          </Link>
          <div className="flex gap-2 shrink-0">
            {b.instagram && <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full bg-white border border-shop-line flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A3328" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></svg></a>}
            <button onClick={() => setSp({ lang: ar ? "en" : "ar" })} className="rounded-full px-3 h-10 bg-white border border-shop-line text-xs font-semibold" lang={ar ? "en" : "ar"}>{ar ? "EN" : "عربي"}</button>
          </div>
        </header>

        {!product ? (
          <>
            <section className="relative mt-5 sm:mt-8 h-56 sm:h-72 lg:h-96 rounded-3xl overflow-hidden bg-shop-sand">
              <div className="absolute inset-0 bg-gradient-to-t from-[#2B1D16]/70 via-transparent" />
              <div className="absolute bottom-5 sm:bottom-8 inset-x-5 sm:inset-x-8 text-shop-cream">
                <h1 className="text-2xl sm:text-3xl lg:text-5xl font-semibold leading-snug">{ar ? <>صُنع <span className="text-[#F0C9C9]">بحب</span> لكِ</> : <>Made with <span className="text-[#F0C9C9]">love</span>, for you</>}</h1>
                <p className="text-sm sm:text-base text-[#EEDFCF] font-light mt-1">{ar ? "كل قطعة بطلبك، غرزة غرزة" : "Every piece to order, stitch by stitch"}</p>
              </div>
            </section>
            <div className="flex flex-wrap gap-2 mt-4">
              {sf.earliestAny && <span className="rounded-full px-3 py-2 text-[11.5px] sm:text-xs font-medium bg-shop-night text-shop-cream">{ar ? "أقرب تسليم: " : "Earliest delivery: "}<span dir="ltr">{sf.earliestAny}</span></span>}
              <span className="rounded-full px-3 py-2 text-[11.5px] sm:text-xs font-medium bg-white border border-shop-line">{ar ? "ألوان متوفرة الآن: " : "Colours in stock: "}{sf.colorsInStock}</span>
            </div>
            <nav className="flex gap-4 sm:gap-6 mt-5 text-sm sm:text-base text-[#9A8273] overflow-x-auto" aria-label={ar ? "الأقسام" : "Categories"}>{cats.map(([k, l]) => <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k} className={`pb-1 whitespace-nowrap ${cat === k ? "text-shop-ink font-semibold border-b-2 border-shop-brown" : ""}`}>{l}</button>)}</nav>
            {list.length === 0 && <p className="text-center text-sm text-[#9A8273] py-10">{ar ? "ما في منتجات بهالقسم هلأ." : "Nothing in this category yet."}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mt-4">
              {list.map((p) => (
                <Link key={p._id} to={`/p/${p.slug}?lang=${lang}`} className="group bg-white rounded-2xl p-2 sm:p-3 border border-shop-line hover:shadow-md transition min-w-0">
                  <div className="aspect-square rounded-xl bg-shop-sand overflow-hidden">{p.imageUrl && <img src={p.imageUrl} alt={pName(p)} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />}</div>
                  <div className="mt-2 font-semibold text-sm sm:text-base truncate">{pName(p)}</div>
                  <div className="text-[11px] sm:text-xs text-[#9A8273]">{ar ? `حسب الطلب · ${p.days} أيام` : `Made to order · ${p.days} days`}</div>
                  <div className="text-shop-brown font-bold">{p.price} {ar ? "د.أ" : "JOD"}</div>
                </Link>
              ))}
            </div>
            <footer className="text-center text-[11px] sm:text-xs text-[#9A8273] mt-12 leading-relaxed">{ar ? "اختر · تواصل · عربون CliQ · تسليم بمكان عام أو توصيل" : "Choose · contact · CliQ deposit · public-place handover or delivery"}<br /><span className="font-shop font-bold text-shop-brown">{ar ? b.fullName : b.fullNameEn}</span> · {ar ? b.craft : b.craftEn} · <span dir="ltr">{b.taglineTr}</span></footer>
          </>
        ) : (
          <div className="mt-5 sm:mt-8">
            <Link to={`/?lang=${lang}`} className="inline-block text-sm text-[#9A8273] mb-4">{ar ? "→ كل المنتجات" : "← All products"}</Link>
            <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
              <div className="aspect-[4/3] sm:aspect-[16/10] lg:aspect-square rounded-3xl bg-shop-sand overflow-hidden lg:sticky lg:top-8">{product.imageUrl && <img src={product.imageUrl} alt={pName(product)} className="w-full h-full object-cover" />}</div>
              <div className="mt-4 lg:mt-0">
                <h1 className="text-2xl sm:text-3xl font-semibold">{pName(product)}</h1>
                <div className="text-shop-brown font-bold text-xl sm:text-2xl mt-1">{product.price} {ar ? "د.أ" : "JOD"}</div>
                <p className="text-sm sm:text-base text-[#6B5A50] mt-3 leading-relaxed">{ar ? product.descAr : product.descEn || product.descAr}</p>
                <div className="flex flex-wrap gap-2 mt-3 text-[11.5px] sm:text-xs"><span className="rounded-full px-3 py-2 bg-shop-night text-shop-cream">{ar ? "أقرب تسليم: " : "Earliest: "}<span dir="ltr">{product.earliest}</span></span><span className="rounded-full px-3 py-2 bg-white border border-shop-line">{product.hours} {ar ? "ساعات عمل" : "hours of work"}</span></div>
                <div className="mt-5 text-sm font-semibold">{ar ? "الألوان المتوفرة فعلاً" : "Colours actually in stock"}</div>
                <div className="flex gap-2 mt-2 flex-wrap">{product.colors.map((c) => <button key={c.id} type="button" disabled={!c.available} aria-pressed={order.color === c.color} onClick={() => setOrder({ ...order, color: c.color })} className={`flex items-center gap-2 rounded-full px-3 py-2 border text-xs ${order.color === c.color ? "border-shop-brown bg-white ring-1 ring-shop-brown" : "border-shop-line bg-white"} ${!c.available ? "opacity-40" : ""}`}><span className="w-4 h-4 rounded-full border border-black/10" style={{ background: c.hex }} />{c.color}{!c.available && (ar ? " · نفد" : " · out")}</button>)}</div>
                {done ? (
                  <div className="mt-6 bg-white rounded-2xl p-4 sm:p-5 border border-shop-line" role="status"><div className="font-semibold">{ar ? "وصل طلبك" : "Order received"}</div><p className="text-sm mt-1 whitespace-pre-line">{done.suggestedReply}</p>{done.whatsapp && <a className="inline-flex items-center mt-3 rounded-xl bg-shop-brown text-white px-4 h-11 text-sm font-semibold" href={`https://wa.me/${done.whatsapp}`} target="_blank" rel="noreferrer">{ar ? "تابعي على واتساب" : "Continue on WhatsApp"}</a>}</div>
                ) : (
                  <form onSubmit={submit} className="mt-6 bg-white rounded-2xl p-4 sm:p-5 border border-shop-line flex flex-col gap-2">
                    <div className="font-semibold">{ar ? "اطلبي" : "Order"}</div>
                    <input required autoComplete="given-name" placeholder={ar ? "اسمك الأول" : "Your first name"} aria-label={ar ? "اسمك الأول" : "Your first name"} value={order.firstName} onChange={(e) => setOrder({ ...order, firstName: e.target.value })} className="border-shop-line" />
                    <input type="tel" inputMode="tel" autoComplete="tel" placeholder={ar ? "رقم واتساب" : "WhatsApp number"} aria-label={ar ? "رقم واتساب" : "WhatsApp number"} value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} className="border-shop-line" dir="ltr" />
                    <input placeholder={ar ? "اسم للنقش أو الإهداء (اختياري)" : "Name to embroider or gift to (optional)"} aria-label={ar ? "اسم للنقش أو الإهداء" : "Name to embroider or gift to"} value={order.name} onChange={(e) => setOrder({ ...order, name: e.target.value })} className="border-shop-line" />
                    <button disabled={sending} className="rounded-xl bg-shop-brown text-white h-11 font-semibold disabled:opacity-60">{sending ? "…" : ar ? "أرسلي الطلب" : "Send order"}</button>
                    <div className="text-[11px] text-[#9A8273] text-center">{ar ? "عربون ٣٥٪ عبر CliQ · تسليم بمكان عام أو توصيل" : "35% CliQ deposit · public-place handover or delivery"}<br />{ar ? b.craft : b.craftEn}</div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
        {wa && !product && <a href={wa} target="_blank" rel="noreferrer" className="fixed z-20 bottom-4 inset-x-4 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:px-6 mb-[env(safe-area-inset-bottom)] rounded-2xl bg-shop-night text-shop-cream text-center py-4 font-semibold shadow-lg">{ar ? "اطلب على واتساب" : "Order on WhatsApp"}</a>}
      </div>
    </div>
  );
}
