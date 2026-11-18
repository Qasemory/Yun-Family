// قراءة كتاب PDF داخل المتصفح: النص لكل صفحة، أو صورة الصفحة (للـ PDF المصوّر) لنقرأها بالذكاء الاصطناعي.
// المكتبة بتنحمّل بس لما تفتح PDF، فما بتثقّل التطبيق.
let libP = null;
function lib() {
  if (!libP) {
    libP = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.js?url")]).then(([pdfjs, w]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = w.default;
      return pdfjs;
    });
  }
  return libP;
}

export async function openPdf(file) {
  const pdfjs = await lib();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

/** نص صفحة (رقمها بالملف يبدأ من ١) */
export async function pageText(doc, n) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  let out = "";
  for (const it of tc.items) { out += it.str || ""; out += it.hasEOL ? "\n" : " "; }
  page.cleanup();
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/** صورة صفحة JPEG (data URL) بعرض تقريبي ١٦٠٠ بكسل */
export async function pageImage(doc, n, width = 1600) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, width / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  canvas.width = canvas.height = 0;
  return url;
}

/** صفحة فيها نص حقيقي؟ (الـ PDF المصوّر بيرجع فاضي أو كم حرف) */
export const hasText = (t) => (t || "").replace(/\s/g, "").length >= 40;
