import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { get } from "../lib/api.js";
import YarnIcon from "../components/YarnIcon.jsx";

export default function GiftCard() {
  const { orderId } = useParams();
  const [sp, setSp] = useSearchParams();
  const lang = sp.get("lang") || "ar";
  const [c, setC] = useState(null);
  useEffect(() => { get(`/shop/gift/${orderId}?lang=${lang}`).then(setC); }, [orderId, lang]);
  if (!c) return null;
  const ar = c.lang === "ar";
  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-shop-sand text-shop-ink font-sans p-4 print:bg-white print:p-0">
      <div className="flex gap-2 justify-center mb-4 print:hidden"><button onClick={() => window.print()} className="rounded-full bg-white border border-shop-line px-4 py-2 text-sm">{ar ? "طباعة" : "Print"}</button><button onClick={() => setSp({ lang: ar ? "en" : "ar" })} className="rounded-full bg-white border border-shop-line px-4 py-2 text-sm">{ar ? "English" : "عربي"}</button></div>
      <div className="flex flex-wrap gap-4 justify-center">
        <div className="w-[105mm] h-[148mm] bg-shop-cream rounded-[6mm] p-[12mm] flex flex-col items-center text-center shadow-lg print:shadow-none print:rounded-none" style={{ pageBreakAfter: "always" }}>
          <YarnIcon size={56} bg={null} fg="#A8683F" />
          <p className="text-[22px] leading-relaxed mt-10">{ar ? <>صُنعت <span className="text-shop-rose font-medium">بحب</span>،<br />غرزة غرزة</> : <>Made with <span className="text-shop-rose font-medium">love</span>,<br />stitch by stitch</>}</p>
          <div className="mt-auto font-shop font-bold text-shop-brown text-3xl">{ar ? c.brand.name : c.brand.nameEn}</div>
        </div>
        <div className="w-[105mm] h-[148mm] bg-white rounded-[6mm] p-[12mm] flex flex-col shadow-lg print:shadow-none print:rounded-none">
          <div className="text-xs text-[#9A8273]">{ar ? "إلى" : "To"}</div>
          <div className="text-2xl font-semibold border-b border-dashed border-shop-line pb-2 mt-1">{c.recipient}</div>
          <div className="text-sm text-[#9A8273] mt-3">{c.line}</div>
          <div className="text-xs text-[#9A8273] mt-2">{c.product}</div>
          <div className="flex-1 border border-dashed border-shop-line rounded-xl mt-3 flex items-center justify-center text-xs text-[#9A8273]">{ar ? "سطر بخط يد رنا" : "A handwritten line"}</div>
          <div className="flex justify-between items-center mt-3 text-[11px] text-[#9A8273]"><span>{c.care}</span><span dir="ltr">{c.brand.taglineTr} · @{c.brand.instagram}</span></div>
        </div>
      </div>
    </div>
  );
}
