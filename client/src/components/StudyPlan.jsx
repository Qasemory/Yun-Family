// الخطة الأسبوعية: صوّر خطة المدرسة ← راجعها ← كل مسا بيتحضّر درس بكرا أو بيجيك إشعار تصوّر الصفحات الناقصة
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post, put } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { shrinkImage } from "../lib/image.js";
import { Card, Msg, Spinner } from "./ui.jsx";

const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const newRow = (day) => ({ key: Math.random().toString(36).slice(2), day, subject: "", book: "", from: "", to: "", topic: "" });

function Editor({ u, data, books, initial, onSaved, onCancel }) {
  const { t, locale } = useT();
  const [rows, setRows] = useState(() => (initial.length ? initial : [newRow(data.days[0])]).map((r) => ({ key: r._id || Math.random().toString(36).slice(2), ...r, book: r.book || "", from: r.from || "", to: r.to || "" })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const dayName = (d) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const items = rows.filter((r) => r.subject.trim()).map(({ key, ...r }) => ({ ...r, book: r.book || null, from: +r.from || null, to: +r.to || +r.from || null }));
      const r = await put("/study/plan", { userId: u, weekStart: data.weekStart, items });
      onSaved(r.prepared);
    } catch { setErr(t("common.notSaved")); }
    setBusy(false);
  };
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  return (
    <Card title={t("plan.review")}>
      <div className="text-xs text-muted mb-3">{t("plan.reviewHint")}</div>
      <div className="flex flex-col gap-3">
        {sorted.map((r) => (
          <fieldset key={r.key} className="rounded-xl border border-line p-2 grid grid-cols-2 sm:grid-cols-6 gap-2 min-w-0">
            <legend className="sr-only">{r.subject || t("plan.item")}</legend>
            <select className="col-span-2 sm:col-span-2 min-w-0" value={r.day} onChange={(e) => set(r.key, { day: e.target.value })} aria-label={t("plan.day")}>{data.days.map((d) => <option key={d} value={d}>{dayName(d)}</option>)}</select>
            <input className="col-span-1 sm:col-span-2 min-w-0" placeholder={t("study.subject")} aria-label={t("study.subject")} value={r.subject} onChange={(e) => set(r.key, { subject: e.target.value })} maxLength={60} />
            <select className="col-span-1 sm:col-span-2 min-w-0" value={r.book} onChange={(e) => set(r.key, { book: e.target.value })} aria-label={t("study.book")}><option value="">{t("plan.noBook")}</option>{books.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}</select>
            <input className="col-span-2 sm:col-span-4 min-w-0" placeholder={t("plan.topic")} aria-label={t("plan.topic")} value={r.topic} onChange={(e) => set(r.key, { topic: e.target.value })} maxLength={160} dir="auto" />
            <div className="col-span-2 sm:col-span-2 flex items-center gap-1 min-w-0">
              <input type="number" inputMode="numeric" className="w-full min-w-0" placeholder={t("books.from")} aria-label={t("plan.pageFrom")} value={r.from} onChange={(e) => set(r.key, { from: e.target.value })} />
              <span aria-hidden="true">–</span>
              <input type="number" inputMode="numeric" className="w-full min-w-0" placeholder={t("books.to")} aria-label={t("plan.pageTo")} value={r.to} onChange={(e) => set(r.key, { to: e.target.value })} />
              <button type="button" className="text-muted px-2 text-lg" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={t("common.remove")}>×</button>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, newRow(rs[rs.length - 1]?.day || data.days[0])])}>+ {t("plan.addRow")}</button>
      </div>
      {err && <div className="mt-2"><Msg kind="err">{err}</Msg></div>}
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn" onClick={save} disabled={busy}>{busy ? "…" : t("plan.save")}</button>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>{t("common.cancel")}</button>
      </div>
    </Card>
  );
}

function ItemRow({ item, today, onChange }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  // تصوير الصفحات الناقصة: كل صورة لصفحة ناقصة بالترتيب
  const photos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, item.missing.length); e.target.value = "";
    if (!files.length) return;
    setBusy("photo"); setMsg(null);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const image = await shrinkImage(files[i], 2000, 0.85);
        const r = await post("/study/page-image", { image });
        if (r.text) { await post(`/study/book/${item.book}/page`, { number: item.missing[i], text: r.text, source: "photo" }); ok++; }
      } catch (ex) { setMsg({ kind: "err", text: ex.message === "ai_off" ? t("ai.off") : t("ai.failed") }); break; }
    }
    setBusy("");
    if (ok) onChange();
  };
  const prepareNow = async () => {
    setBusy("prep"); setMsg(null);
    try { await post(`/study/plan/item/${item._id}/prepare`); onChange(); }
    catch (ex) { setMsg({ kind: "err", text: t(`err.${ex.message}`, null, t("ai.failed")) }); }
    setBusy("");
  };
  const pagesLabel = item.from ? (item.to > item.from ? t("plan.pages", { a: item.from, b: item.to }) : t("plan.pageOne", { a: item.from })) : "";
  const l = item.lesson;
  return (
    <div className="py-2 border-b border-line last:border-0 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm"><span dir="auto">{item.subject}</span>{item.topic && <span className="font-normal text-muted"> · <span dir="auto">{item.topic}</span></span>}</div>
          <div className="text-xs text-muted">{item.bookTitle ? <bdi>{item.bookTitle}</bdi> : t("plan.noBook")}{pagesLabel && <> · <bdi>{pagesLabel}</bdi></>}</div>
        </div>
        {l ? (
          <Link to={fam(`/lesson/${l._id}`)} className={`pill shrink-0 ${l.stage === "done" || l.stage === "summary" ? (l.mastered ? "pill-green" : "pill-gold") : "pill-green"}`}>
            {l.stage === "done" || l.stage === "summary" ? `${l.score ?? 0}%` : `✅ ${t("plan.lessonReady")}`}
          </Link>
        ) : item.ready ? <span className="pill shrink-0">{t("plan.pagesReady")}</span>
          : <span className="pill pill-gold shrink-0">{item.noPages ? t("plan.needPages") : t("plan.missingN", { n: item.missing.length })}</span>}
      </div>
      {!l && item.ready && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {item.day < today ? t("plan.pastDay") : item.day > addDays(today, 1) ? t("plan.willPrepare") : t("plan.preparingSoon")}
          <button className="btn-ghost btn-sm" onClick={prepareNow} disabled={!!busy}>{busy === "prep" ? `${t("ai.working")}` : t("plan.prepareNow")}</button>
        </div>
      )}
      {!l && !item.ready && !item.noPages && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t("plan.missingList", { list: item.missing.join("، ") })}</span>
          <input ref={fileRef} type="file" accept="image/*" capture={item.missing.length === 1 ? "environment" : undefined} multiple={item.missing.length > 1} className="hidden" onChange={photos} />
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy === "photo" ? t("study.reading") : `📷 ${item.missing.length === 1 ? t("plan.photoOne", { n: item.missing[0] }) : t("plan.photoMany", { n: item.missing.length })}`}</button>
        </div>
      )}
      {!l && item.noPages && <div className="text-xs text-muted">{t("plan.noPagesHint")}</div>}
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
    </div>
  );
}

export default function StudyPlan({ u, books }) {
  const { t, locale } = useT();
  const [week, setWeek] = useState("");
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null); // null | items[]
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const load = () => get(`/study/plan?u=${u}${week ? `&week=${week}` : ""}`).then((x) => { setD(x); if (!week) setWeek(x.weekStart); });
  useEffect(() => { setD(null); setEdit(null); setMsg(null); load(); /* eslint-disable-next-line */ }, [u, week]);
  if (!d) return <Spinner />;
  const readPlan = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 3); e.target.value = "";
    if (!files.length) return;
    setBusy(true); setMsg(null);
    try {
      const images = [];
      for (const f of files) images.push(await shrinkImage(f, 2000, 0.85));
      const r = await post("/study/plan/read", { userId: u, weekStart: d.weekStart, images });
      if (!r.items.length) setMsg({ kind: "warn", text: t("plan.readEmpty") });
      // نحافظ على البنود القديمة اللي إلها دروس؟ لا: القراءة الجديدة بتبدّل المسودة، والحفظ بيربط اللي ما تغيّر
      setEdit(r.items.map((i) => ({ ...i, key: Math.random().toString(36).slice(2) })));
    } catch (ex) { setMsg({ kind: "err", text: ex.message === "bad_image" ? t("common.badImage") : t("ai.failed") }); }
    setBusy(false);
  };
  const fmt = (day) => new Date(day + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const weekLabel = d.weekStart === d.thisWeek ? t("plan.thisWeek") : d.weekStart === addDays(d.thisWeek, 7) ? t("plan.nextWeek") : `${fmt(d.days[0])} – ${fmt(d.days[d.days.length - 1])}`;
  const byDay = d.days.map((day) => ({ day, items: d.items.filter((i) => i.day === day) }));
  const dayName = (day) => new Date(day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setWeek(addDays(d.weekStart, -7))} aria-label={t("plan.prevWeek")}><span className="rtl:hidden">‹</span><span className="ltr:hidden">›</span></button>
        <div className="text-center"><div className="font-semibold">{weekLabel}</div><div className="text-xs text-muted">{fmt(d.days[0])} – {fmt(d.days[d.days.length - 1])}</div></div>
        <button className="btn-ghost btn-sm" onClick={() => setWeek(addDays(d.weekStart, 7))} aria-label={t("plan.nextWeekBtn")}><span className="rtl:hidden">›</span><span className="ltr:hidden">‹</span></button>
      </div>

      {edit ? (
        <Editor u={u} data={d} books={books} initial={edit} onCancel={() => setEdit(null)} onSaved={(n) => { setEdit(null); setMsg({ kind: "ok", text: n ? t("plan.savedPrepared", { n }) : t("plan.saved") }); load(); }} />
      ) : (
        <>
          <Card title={`🗓️ ${t("plan.title")}`} right={d.saved && <button className="btn-ghost btn-sm" onClick={() => setEdit(d.items)}>{t("common.edit")}</button>}>
            <ol className="text-xs text-muted list-decimal ps-5 flex flex-col gap-0.5 mb-3">
              <li>{t("plan.how1")}</li><li>{t("plan.how2")}</li><li>{t("plan.how3")}</li>
            </ol>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={readPlan} />
            <div className="flex flex-wrap gap-2">
              {d.ai ? <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? t("plan.reading") : `📷 ${d.saved ? t("plan.rephoto") : t("plan.photo")}`}</button> : <div className="text-xs text-muted">{t("ai.off")}</div>}
              {!d.saved && <button className="btn-ghost" onClick={() => setEdit([])} disabled={busy}>{t("plan.manual")}</button>}
            </div>
            {busy && <div className="mt-2"><Msg kind="warn">{t("ai.working")}</Msg></div>}
            {books.length === 0 && <div className="mt-2"><Msg kind="warn">{t("plan.addBooksFirst")}</Msg></div>}
          </Card>
          {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
          {d.saved && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {byDay.map(({ day, items }) => (
                <Card key={day} title={<span>{dayName(day)}{day === d.today && <span className="pill pill-green ms-2">{t("common.today")}</span>}</span>} className={day < d.today ? "opacity-70" : ""}>
                  {items.length === 0 ? <div className="text-sm text-muted">{t("plan.nothing")}</div> : items.map((i) => <ItemRow key={i._id} item={i} today={d.today} onChange={load} />)}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
