import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { get } from "../lib/api.js";
import { useDocumentLang } from "../lib/i18n.js";
import YarnIcon from "../components/YarnIcon.jsx";

// بطاقة الهدية: بحجم A6 عند الطباعة، وتتقلّص لتناسب شاشة الموبايل
export default function GiftCard() {
  const { orderId } = useParams();
  const [sp, setSp] = useSearchParams();
  const lang = sp.get("lang") || "ar";
  const [c, setC] = useState(null);
  useEffect(() => { get(`/shop/gift/${orderId}?lang=${lang}`).then(setC); }, [orderId, lang]);
  const ar = (c?.lang || lang) === "ar";
  useDocumentLang(ar ? "ar" : "en", ar ? "rtl" : "ltr", ar ? "بطاقة هدية" : "Gift card");
  if (!c) return null;
  const card = "w-full max-w-[105mm] aspect-[105/148] print:w-[105mm] print:h-[148mm] print:max-w-none print:aspect-auto rounded-[6mm] p-[8%] flex flex-col shadow-lg print:shadow-none print:rounded-none";
  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-shop-sand text-shop-ink font-sans p-4 sm:p-8 print:bg-white print:p-0">
      <div className="flex gap-2 justify-center mb-4 print:hidden"><button onClick={() => window.print()} className="rounded-full bg-white border border-shop-line px-4 h-10 text-sm">{ar ? "طباعة" : "Print"}</button><button onClick={() => setSp({ lang: ar ? "en" : "ar" })} className="rounded-full bg-white border border-shop-line px-4 h-10 text-sm">{ar ? "English" : "عربي"}</button></div>
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-center md:items-start justify-center">
        <div className={`${card} bg-shop-cream items-center text-center`} style={{ pageBreakAfter: "always" }}>
          <YarnIcon size={56} bg={null} fg="#A8683F" />
          <p className="text-[clamp(16px,5vw,22px)] leading-relaxed mt-[15%]">{ar ? <>صُنعت <span className="text-shop-rose font-medium">بحب</span>،<br />غرزة غرزة</> : <>Made with <span className="text-shop-rose font-medium">love</span>,<br />stitch by stitch</>}</p>
          <div className="mt-auto font-shop font-bold text-shop-brown text-[clamp(22px,7vw,30px)]">{ar ? c.brand.name : c.brand.nameEn}</div>
        </div>
        <div className={`${card} bg-white`}>
          <div className="text-xs text-[#9A8273]">{ar ? "إلى" : "To"}</div>
          <div className="text-xl sm:text-2xl font-semibold border-b border-dashed border-shop-line pb-2 mt-1 break-words">{c.recipient}</div>
          <div className="text-sm text-[#9A8273] mt-3">{c.line}</div>
          <div className="text-xs text-[#9A8273] mt-2">{c.product}</div>
          <div className="flex-1 border border-dashed border-shop-line rounded-xl mt-3 flex items-center justify-center text-xs text-[#9A8273]">{ar ? "سطر بخط يد رنا" : "A handwritten line"}</div>
          <div className="flex flex-wrap justify-between items-center gap-1 mt-3 text-[10px] sm:text-[11px] text-[#9A8273]"><span>{c.care}</span><span dir="ltr">{c.brand.taglineTr} · @{c.brand.instagram}</span></div>
        </div>
      </div>
    </div>
  );
}
