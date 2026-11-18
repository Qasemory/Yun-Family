// الكتب: إضافة كتاب، الفهرس، رفع PDF، تصوير وحدة كاملة، ودرس سريع من صفحة
import { useRef, useState } from "react";
import { get, post, del } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { shrinkImage } from "../lib/image.js";
import { openPdf, pageText, pageImage, hasText } from "../lib/pdf.js";
import { Card, Msg } from "./ui.jsx";

export const SUBJECTS = ["English", "Maths", "Science", "عربي", "إسلامية", "ICT", "Social Studies"];
const errText = (t, e) => t(`err.${e?.message}`, null, t("ai.failed"));

function Progress({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1" role="status" aria-live="polite">
      <div className="text-xs text-muted">{label} · {done}/{total}</div>
      <div className="h-2 rounded-full bg-ivory border border-line overflow-hidden"><div className="h-full bg-olive transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** رفع كتاب PDF: النص بيتقرأ بالمتصفح، والصفحات المصوّرة (بدون نص) بتنقرأ بالذكاء لمدى بتختاره */
function PdfImport({ book, ai, onDone }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const docRef = useRef(null);
  const [offset, setOffset] = useState(1);   // صفحة ١ بالكتاب = صفحة رقم كذا بالملف
  const [prog, setProg] = useState(null);
  const [res, setRes] = useState(null);      // { saved, scanned: [bookPage...], total }
  const [ocr, setOcr] = useState({ from: "", to: "" });
  const [msg, setMsg] = useState(null);
  const toBook = (fileN) => fileN - (Math.max(1, +offset || 1) - 1);
  const toFile = (bookN) => bookN + (Math.max(1, +offset || 1) - 1);

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setMsg(null); setRes(null);
    try {
      const doc = await openPdf(f); docRef.current = doc;
      const total = doc.numPages, scanned = [];
      let batch = [], saved = 0;
      setProg({ done: 0, total, label: t("books.pdfReading") });
      for (let n = 1; n <= total; n++) {
        const num = toBook(n);
        if (num >= 1) {
          const text = await pageText(doc, n);
          if (hasText(text)) batch.push({ number: num, text }); else scanned.push(num);
        }
        if (batch.length === 20 || (n === total && batch.length)) {
          await post(`/study/book/${book._id}/pages`, { pages: batch, source: "pdf", last: n === total });
          saved += batch.length; batch = [];
        }
        setProg({ done: n, total, label: t("books.pdfReading") });
      }
      setRes({ saved, scanned, total });
      if (scanned.length) setOcr({ from: String(scanned[0]), to: String(scanned[Math.min(scanned.length, 10) - 1]) });
      onDone?.();
    } catch (ex) { setMsg({ kind: "err", text: ex?.name === "PasswordException" ? t("books.pdfLocked") : t("books.pdfFailed") }); }
    setProg(null);
  };

  // قراءة صفحات مصوّرة من الـ PDF بالذكاء (حد ٣٠ بالمرة)
  const readScanned = async () => {
    const doc = docRef.current; if (!doc) return;
    const from = +ocr.from, to = Math.min(+ocr.to, from + 29);
    if (!from || to < from) return;
    setMsg(null);
    let done = 0, ok = 0;
    const total = to - from + 1;
    setProg({ done, total, label: t("books.ocrReading") });
    for (let b = from; b <= to; b++) {
      const fileN = toFile(b);
      if (fileN >= 1 && fileN <= doc.numPages) {
        try {
          const image = await pageImage(doc, fileN);
          const r = await post("/study/page-image", { image });
          if (r.text) { await post(`/study/book/${book._id}/page`, { number: b, text: r.text, source: "photo" }); ok++; }
        } catch (ex) { if (ex.message === "ai_off") { setMsg({ kind: "err", text: t("ai.off") }); break; } }
      }
      setProg({ done: ++done, total, label: t("books.ocrReading") });
    }
    setProg(null);
    setMsg({ kind: ok ? "ok" : "warn", text: t("books.ocrDone", { n: ok }) });
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted">{t("books.pdfHint")}</div>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        {t("books.offset")}
        <input type="number" inputMode="numeric" min="1" className="w-20" value={offset} onChange={(e) => setOffset(e.target.value)} aria-describedby={`off-${book._id}`} />
      </label>
      <div id={`off-${book._id}`} className="text-[11px] text-muted">{t("books.offsetHint")}</div>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={pick} />
      <button type="button" className="btn-ghost sm:self-start" disabled={!!prog} onClick={() => fileRef.current?.click()}>📄 {t("books.pdfPick")}</button>
      {prog && <Progress {...prog} />}
      {res && (
        <Msg kind={res.scanned.length ? "warn" : "ok"}>
          {t("books.pdfDone", { n: res.saved })}{res.scanned.length > 0 && <> {t("books.pdfScanned", { n: res.scanned.length })}</>}
        </Msg>
      )}
      {res?.scanned.length > 0 && docRef.current && (ai ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">{t("books.from")}<input type="number" className="w-20 block" value={ocr.from} onChange={(e) => setOcr({ ...ocr, from: e.target.value })} /></label>
          <label className="text-xs">{t("books.to")}<input type="number" className="w-20 block" value={ocr.to} onChange={(e) => setOcr({ ...ocr, to: e.target.value })} /></label>
          <button type="button" className="btn btn-sm" disabled={!!prog} onClick={readScanned}>{t("books.ocrRun")}</button>
          <div className="text-[11px] text-muted w-full">{t("books.ocrHint")}</div>
        </div>
      ) : <div className="text-xs text-muted">{t("ai.off")}</div>)}
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
    </div>
  );
}

/** تصوير صفحات ورا بعض (وحدة كاملة): كل صورة صفحة، بالترتيب من رقم البداية */
function PhotoPages({ book, ai, onDone }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const [start, setStart] = useState("");
  const [prog, setProg] = useState(null);
  const [msg, setMsg] = useState(null);
  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 30); e.target.value = "";
    if (!files.length || !+start) return;
    setMsg(null);
    let ok = 0;
    setProg({ done: 0, total: files.length, label: t("books.ocrReading") });
    for (let i = 0; i < files.length; i++) {
      try {
        const image = await shrinkImage(files[i], 2000, 0.85);
        const r = await post("/study/page-image", { image });
        if (r.text) { await post(`/study/book/${book._id}/page`, { number: +start + i, text: r.text, source: "photo" }); ok++; }
      } catch (ex) { if (ex.message === "ai_off") { setMsg({ kind: "err", text: t("ai.off") }); break; } }
      setProg({ done: i + 1, total: files.length, label: t("books.ocrReading") });
    }
    setProg(null);
    setMsg({ kind: ok === files.length ? "ok" : "warn", text: t("books.photosDone", { n: ok, from: start, to: +start + files.length - 1 }) });
    setStart("");
    onDone?.();
  };
  if (!ai) return <div className="text-xs text-muted">{t("ai.off")}</div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted">{t("books.photosHint")}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" inputMode="numeric" min="1" className="w-28" placeholder={t("books.startPage")} aria-label={t("books.startPage")} value={start} onChange={(e) => setStart(e.target.value)} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
        <button type="button" className="btn-ghost" disabled={!+start || !!prog} onClick={() => fileRef.current?.click()}>📷 {t("books.photosPick")}</button>
      </div>
      {prog && <Progress {...prog} />}
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
    </div>
  );
}

function Toc({ book, ai, onDone }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [fromPage, setFromPage] = useState("");
  const [open, setOpen] = useState(false);
  const run = async (body) => {
    setBusy(true); setMsg(null);
    try { const r = await post(`/study/book/${book._id}/toc`, body); setMsg({ kind: "ok", text: t("books.tocDone", { n: r.toc.length }) }); setOpen(true); onDone?.(); }
    catch (ex) { setMsg({ kind: "err", text: ex.message === "toc_empty" ? t("books.tocEmpty") : errText(t, ex) }); }
    setBusy(false);
  };
  const photo = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { run({ image: await shrinkImage(f, 2000, 0.85) }); } catch { setMsg({ kind: "err", text: t("common.badImage") }); }
  };
  const toc = book.toc || [];
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted">{t("books.tocHint")}</div>
      {ai ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={photo} />
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>📷 {t("books.tocPhoto")}</button>
          {book.pageCount > 0 && (
            <span className="flex items-center gap-1 text-xs">
              {t("books.tocFromPage")}
              <input type="number" className="w-16" value={fromPage} onChange={(e) => setFromPage(e.target.value)} aria-label={t("books.tocFromPage")} />
              <button type="button" className="btn-ghost btn-sm" disabled={busy || !+fromPage} onClick={() => run({ fromPage: +fromPage, toPage: +fromPage + 2 })}>{t("books.read")}</button>
            </span>
          )}
        </div>
      ) : <div className="text-xs text-muted">{t("ai.off")}</div>}
      {busy && <Msg kind="warn">{t("ai.working")}</Msg>}
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      {toc.length > 0 && (
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="text-sm cursor-pointer">{t("books.tocShow", { n: toc.length })}</summary>
          <ol className="text-sm mt-1 flex flex-col gap-0.5 font-en" dir="ltr">
            {toc.map((e, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate" dir="auto">{e.title}</span><span className="text-muted shrink-0">p.{e.page}</span></li>)}
          </ol>
        </details>
      )}
    </div>
  );
}

function BookCard({ book, ai, onChange }) {
  const { t } = useT();
  const [tab, setTab] = useState("");
  const [pages, setPages] = useState(null);
  const showPages = async () => { const r = await get(`/study/book/${book._id}/pages`); setPages(r.pages.map((p) => p.number)); };
  const remove = async () => { if (!window.confirm(t("books.deleteAsk", { name: book.title }))) return; await del(`/study/book/${book._id}`); onChange(); };
  const done = () => { onChange(); if (pages) showPages(); };
  const tabs = [["toc", `📑 ${t("books.toc")}`], ["pdf", `📄 PDF`], ["photos", `📷 ${t("books.photos")}`]];
  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><div className="font-semibold" dir="auto">{book.title}</div><div className="text-xs text-muted"><bdi>{book.subject}</bdi> · <bdi>{t("books.pagesSaved", { n: book.pageCount || 0 })}</bdi>{book.toc?.length ? <> · <bdi>{t("books.tocN", { n: book.toc.length })}</bdi></> : ""}</div></div>
        <div className="flex gap-1 flex-wrap">
          {book.pageCount > 0 && <button className="text-xs text-muted underline" onClick={showPages}>{t("books.whichPages")}</button>}
          <button className="text-xs text-muted underline" onClick={remove}>{t("common.remove")}</button>
        </div>
      </div>
      {pages && <div className="text-xs bg-ivory rounded-lg px-2 py-1.5" dir="ltr">{compress(pages) || "—"}</div>}
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn-sm ${tab === k ? "btn" : "btn-ghost"}`} onClick={() => setTab(tab === k ? "" : k)}>{label}</button>)}
      </div>
      {tab === "toc" && <Toc book={book} ai={ai} onDone={done} />}
      {tab === "pdf" && <PdfImport book={book} ai={ai} onDone={done} />}
      {tab === "photos" && <PhotoPages book={book} ai={ai} onDone={done} />}
    </div>
  );
}

/** [1,2,3,7,8] ← "1–3, 7–8" */
function compress(nums) {
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`); i = j;
  }
  return out.join(", ");
}

/** درس سريع من صفحة وحدة (بدون خطة) */
function QuickLesson({ u, books, ai, onDone }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const [page, setPage] = useState({ bookId: "", number: "", text: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const readPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("reading"); setMsg(null);
    try {
      const image = await shrinkImage(f, 2000, 0.85);
      const r = await post("/study/page-image", { image });
      setPage((p) => ({ ...p, text: p.text ? `${p.text}\n\n${r.text}` : r.text }));
      setMsg({ kind: "ok", text: t("study.readDone") });
    } catch { setMsg({ kind: "err", text: t("ai.failed") }); }
    setBusy("");
  };
  const addPage = async (e) => {
    e.preventDefault();
    setBusy("preparing"); setMsg(null);
    try {
      await post(`/study/book/${page.bookId}/page`, { number: page.number, text: page.text });
      await post("/study/prepare", { userId: u, bookId: page.bookId, pageNumber: page.number });
      setPage({ bookId: page.bookId, number: "", text: "" });
      setMsg({ kind: "ok", text: t("study.prepared") });
      onDone();
    } catch (err) { setMsg({ kind: "err", text: errText(t, err) }); }
    setBusy("");
  };
  return (
    <Card title={t("study.pageToLesson")}>
      <div className="text-xs text-muted mb-2">{t("books.quickHint")}</div>
      <form onSubmit={addPage} className="flex flex-col gap-2">
        <div className="flex gap-2"><select className="flex-1 min-w-0" value={page.bookId} onChange={(e) => setPage({ ...page, bookId: e.target.value })} aria-label={t("study.book")}><option value="">{t("study.book")}</option>{books.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}</select><input className="w-24" type="number" inputMode="numeric" placeholder={t("study.page")} aria-label={t("study.page")} value={page.number} onChange={(e) => setPage({ ...page, number: e.target.value })} /></div>
        {ai ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={readPhoto} />
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={!!busy}>{t("study.photo")}</button>
          </>
        ) : <div className="text-xs text-muted">{t("ai.off")}</div>}
        <textarea className="h-40 py-2 font-en" dir="ltr" placeholder="Paste or type the page text, or take a photo of the page." value={page.text} onChange={(e) => setPage({ ...page, text: e.target.value })} />
        {busy && <Msg kind="warn">{t(busy === "reading" ? "study.reading" : "study.preparing")} {ai ? `· ${t("ai.working")}` : ""}</Msg>}
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
        <button className="btn" disabled={!page.bookId || !page.number || !page.text || !!busy}>{t("study.prepare")}</button>
      </form>
    </Card>
  );
}

export default function StudyBooks({ u, data, onChange }) {
  const { t } = useT();
  const [book, setBook] = useState({ subject: "Science", title: "" });
  const [err, setErr] = useState("");
  const addBook = async (e) => {
    e.preventDefault(); setErr("");
    try { await post("/study/book", { userId: u, ...book }); setBook({ subject: book.subject, title: "" }); onChange(); }
    catch (ex) { setErr(errText(t, ex)); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card title={t("study.books")}>
        <div className="text-xs text-muted mb-3">{t("books.intro")}</div>
        <div className="flex flex-col gap-2 mb-3">
          {data.books.length === 0 && <div className="text-sm text-muted">{t("books.none")}</div>}
          {data.books.map((b) => <BookCard key={b._id} book={b} ai={data.ai} onChange={onChange} />)}
        </div>
        <form onSubmit={addBook} className="flex flex-col sm:flex-row gap-2">
          <select value={book.subject} onChange={(e) => setBook({ ...book, subject: e.target.value })} aria-label={t("study.subject")}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          <input className="flex-1 min-w-0" placeholder={t("study.bookName")} aria-label={t("study.bookName")} value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} maxLength={120} />
          <button className="btn-ghost" disabled={!book.title.trim()}>{t("common.add")}</button>
        </form>
        {err && <div className="mt-2"><Msg kind="err">{err}</Msg></div>}
      </Card>
      <QuickLesson u={u} books={data.books} ai={data.ai} onDone={onChange} />
    </div>
  );
}
