import { Router } from "express";
import { requireAuth, loadSubject, isParent, canAccess } from "../middleware/auth.js";
import { Book, Page, Lesson, User, StudyPlan } from "../models/index.js";
import { prepareLesson, gradeAnswer, gradeExam, explainAgain, pageImageToText, readToc, readWeeklyPlan } from "../utils/study.js";
import { itemPages, prepareItem, autoPrepare, weekDays } from "../utils/studyplan.js";
import { aiReady } from "../utils/ai.js";
import { award } from "../utils/points.js";
import { checkBadges } from "../utils/journey.js";
import { addDays, today, weekStart, isWeekend } from "../utils/dates.js";

const r = Router();
r.use(requireAuth);
const MAX_TRIES = 3; // بعد ٣ محاولات نوريه الجواب ونكمّل، ونسجّلها للمراجعة

// الدرس لازم يكون لحدا من نفس العيلة
async function ownLesson(req, res) {
  const l = await Lesson.findById(req.params.id);
  if (!l) { res.status(404).json({ error: "not_found" }); return null; }
  const owner = String(l.user) === String(req.user._id) ? req.user : await User.findById(l.user).lean();
  if (!owner || String(owner.family) !== String(req.user.family)) { res.status(404).json({ error: "not_found" }); return null; }
  return { l, stage: owner.grade || "Stage 4" };
}
// الولد ما بيشوف الأجوبة النموذجية قبل ما يجاوب
function forChild(l, viewer) {
  const o = l.toObject ? l.toObject() : l;
  if (isParent(viewer.role) || ["summary", "done"].includes(o.stage)) return o;
  return { ...o, points: o.points.map((p, i) => (i < o.currentPoint ? p : { ...p, answer: undefined })), exam: o.exam.map((q) => ({ ...q, modelAnswer: undefined, keywords: undefined })), parentNote: undefined };
}

// الكتاب لازم يكون لولد من نفس العيلة، والتعديل للأهل بس
async function ownBook(req, res) {
  if (!isParent(req.user.role)) { res.status(403).json({ error: "parents_only" }); return null; }
  const book = await Book.findById(req.params.bookId);
  const owner = book && (await User.findById(book.user).lean());
  if (!book || !owner || !canAccess(req.user, owner).canEdit) { res.status(404).json({ error: "not_found" }); return null; }
  return { book, owner };
}
const cleanText = (t) => String(t || "").slice(0, 20000);

r.get("/", loadSubject(), async (req, res) => {
  if (isParent(req.user.role)) await autoPrepare(req.subject._id).catch(() => 0);
  const books = await Book.find({ user: req.subject._id }).lean();
  const counts = await Page.aggregate([{ $match: { book: { $in: books.map((b) => b._id) }, text: { $nin: [null, ""] } } }, { $group: { _id: "$book", n: { $sum: 1 } } }]);
  const pagesOf = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  const lessons = await Lesson.find({ user: req.subject._id }).sort({ createdAt: -1 }).limit(30).lean();
  const done = lessons.filter((l) => l.stage === "done");
  const reviewable = lessons.filter((l) => l.stage === "done" && !l.reviewed && !l.isReview && l.mistakes?.length).reduce((a, l) => a + l.mistakes.length, 0);
  const parent = isParent(req.user.role);
  res.json({
    ai: aiReady(), reviewable,
    books: books.map((b) => ({ ...b, pageCount: pagesOf[String(b._id)] || 0 })),
    lessons: lessons.map((l) => ({ _id: l._id, title: l.title, forDay: l.forDay, stage: l.stage, score: l.score, mastered: l.mastered, isReview: l.isReview, points: l.points.map(() => 0), parentNote: parent ? l.parentNote : undefined })),
    mastery: { lessons: done.length, mastered: done.filter((l) => l.mastered).length, avg: done.length ? Math.round(done.reduce((a, l) => a + (l.score || 0), 0) / done.length) : null },
  });
});
r.post("/book", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  if (!req.canEdit) return res.status(403).json({ error: "forbidden" });
  const subject = String(req.body?.subject || "").slice(0, 40), title = String(req.body?.title || "").trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: "title_required" });
  res.json(await Book.create({ user: req.subject._id, subject, title, stage: req.subject.grade }));
});
r.delete("/book/:bookId", async (req, res) => {
  const o = await ownBook(req, res); if (!o) return;
  await Page.deleteMany({ book: o.book._id });
  await o.book.deleteOne();
  res.json({ ok: true });
});
r.post("/book/:bookId/page", async (req, res) => {
  const o = await ownBook(req, res); if (!o) return;
  const { number, text } = req.body || {};
  const page = await Page.findOneAndUpdate({ book: o.book._id, number: +number || 1 }, { $set: { text: cleanText(text), source: req.body?.source === "photo" ? "photo" : "typed" } }, { new: true, upsert: true });
  const prepared = await autoPrepare(o.owner._id).catch(() => 0);
  res.json({ ...page.toObject(), prepared });
});
// صفحات كتير مرة وحدة (من PDF أو تصوير وحدة كاملة). حد أعلى ٤٠ صفحة بالطلب.
r.post("/book/:bookId/pages", async (req, res) => {
  const o = await ownBook(req, res); if (!o) return;
  const pages = (Array.isArray(req.body?.pages) ? req.body.pages : []).filter((p) => +p.number >= 1 && +p.number < 2000 && String(p.text || "").trim()).slice(0, 40);
  if (!pages.length) return res.status(400).json({ error: "no_pages" });
  const source = req.body?.source === "pdf" ? "pdf" : "photo";
  await Page.bulkWrite(pages.map((p) => ({ updateOne: { filter: { book: o.book._id, number: +p.number }, update: { $set: { text: cleanText(p.text), source } }, upsert: true } })));
  const prepared = req.body?.last ? await autoPrepare(o.owner._id).catch(() => 0) : 0;
  res.json({ saved: pages.length, prepared });
});
// أرقام الصفحات المحفوظة (لنعرف شو ناقص)
r.get("/book/:bookId/pages", async (req, res) => {
  const o = await ownBook(req, res); if (!o) return;
  const pages = await Page.find({ book: o.book._id, text: { $nin: [null, ""] } }).select("number source").sort({ number: 1 }).lean();
  res.json({ pages: pages.map((p) => ({ number: p.number, source: p.source })) });
});
// الفهرس: من صورة، أو من صفحات محفوظة بالكتاب (PDF)
r.post("/book/:bookId/toc", async (req, res) => {
  const o = await ownBook(req, res); if (!o) return;
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  let text = "";
  if (!req.body?.image) {
    const from = +req.body?.fromPage || 0, to = Math.min(from + 4, +req.body?.toPage || from);
    const pages = from ? await Page.find({ book: o.book._id, number: { $gte: from, $lte: to } }).sort({ number: 1 }).lean() : [];
    text = pages.map((p) => p.text).join("\n");
    if (!text.trim()) return res.status(400).json({ error: "page_text_required" });
  }
  const out = await readToc({ image: req.body?.image, text });
  if (out.error) return res.status(out.error === "bad_image" ? 400 : 502).json(out);
  if (!out.toc.length) return res.status(422).json({ error: "toc_empty" });
  o.book.toc = out.toc; await o.book.save();
  res.json({ toc: o.book.toc });
});
// صورة صفحة الكتاب ← نص (الأهل يراجعوه قبل التحضير). الصورة ما بتنحفظ.
r.post("/page-image", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  const out = await pageImageToText(req.body?.image);
  if (out.error) return res.status(out.error === "bad_image" ? 400 : 502).json(out);
  res.json(out);
});
// تحضير درس الغد من نص الصفحة
r.post("/prepare", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { bookId, pageNumber, title } = req.body || {};
  const book = await Book.findOne({ _id: bookId, user: req.subject._id }).lean();
  const page = await Page.findOne({ book: bookId, number: +pageNumber }).lean();
  if (!book || !page?.text) return res.status(400).json({ error: "page_text_required" });
  const prep = await prepareLesson(title || `${book.title} p.${pageNumber}`, page.text, req.subject.grade || "Stage 4");
  const lesson = await Lesson.create({ user: req.subject._id, book: bookId, forDay: addDays(today(), 1), ...prep });
  res.json({ _id: lesson._id, aiPrepared: lesson.aiPrepared });
});
// مراجعة ذكية: درس جديد من النقاط اللي غلط فيها الولد بآخر الدروس
r.post("/review", loadSubject(), async (req, res) => {
  const src = await Lesson.find({ user: req.subject._id, stage: "done", reviewed: false, isReview: false, "mistakes.0": { $exists: true } }).sort({ createdAt: -1 }).limit(5);
  const points = src.flatMap((l) => l.mistakes.map((i) => l.points[i]).filter(Boolean)).slice(0, 6).map((p) => { const o = p.toObject(); delete o._id; return o; });
  if (!points.length) return res.status(400).json({ error: "nothing_to_review" });
  const exam = points.slice(0, 3).map((p) => ({ command: "Explain", question: p.question, modelAnswer: p.answer, keywords: (p.answer || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3).slice(0, 3), marks: 2 }));
  const lesson = await Lesson.create({ user: req.subject._id, title: `Review: ${src.map((l) => l.title).slice(0, 2).join(" + ")}`, forDay: today(), objective: "I can remember the ideas I found hard last time.", points, exam, isReview: true, aiPrepared: false });
  await Lesson.updateMany({ _id: { $in: src.map((l) => l._id) } }, { $set: { reviewed: true } });
  res.json({ _id: lesson._id });
});
r.get("/lesson/:id", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  res.json({ ...forChild(o.l, req.user), ai: aiReady() });
});
r.post("/lesson/:id/start", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  o.l.stage = "learn"; o.l.currentPoint = 0; o.l.attempts = 0; await o.l.save();
  res.json({ ok: true });
});
r.post("/lesson/:id/point", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  const l = o.l, p = l.points[l.currentPoint];
  if (l.stage !== "learn" || !p) return res.status(400).json({ error: "bad_stage" });
  l.attempts = (l.attempts || 0) + 1;
  const g = await gradeAnswer(p, req.body?.answer, o.stage, l.attempts);
  let reveal = null;
  if (!g.ok && l.attempts === 1 && !l.mistakes.includes(l.currentPoint)) l.mistakes.push(l.currentPoint);
  if (g.ok || l.attempts >= MAX_TRIES) {
    if (!g.ok) reveal = p.answer;
    l.currentPoint += 1; l.attempts = 0;
    if (l.currentPoint >= l.points.length) l.stage = "exam";
  }
  await l.save();
  res.json({ ...g, reveal, stage: l.stage, currentPoint: l.currentPoint });
});
// "اشرحلي كمان مرة" (مع سؤال اختياري من الولد)
r.post("/lesson/:id/explain", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  const p = o.l.points[o.l.currentPoint];
  if (!p) return res.status(400).json({ error: "bad_stage" });
  res.json(await explainAgain(p, o.stage, String(req.body?.question || "").slice(0, 300)));
});
r.post("/lesson/:id/exam", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  const l = o.l;
  if (l.stage !== "exam") return res.status(400).json({ error: "bad_stage" });
  const g = await gradeExam(l, req.body?.answers || [], o.stage);
  l.score = g.score; l.mastered = g.score >= 90; l.stage = "summary";
  l.summary = g.summary; l.parentNote = g.parentNote; l.examDetail = g.detail;
  await l.save();
  if (l.mastered) { await award(l.user, 20, `إتقان: ${l.title}`, "lesson"); const kid = await User.findById(l.user).lean(); if (kid) await checkBadges(kid); }
  res.json({ score: g.score, detail: g.detail, mastered: l.mastered, summary: l.summary });
});
r.post("/lesson/:id/finish", async (req, res) => {
  const o = await ownLesson(req, res); if (!o) return;
  o.l.stage = "done"; await o.l.save();
  res.json({ ok: true });
});

// ---------- الخطة الأسبوعية ----------
// الأسبوع الافتراضي: الحالي، وبالويكند (جمعة/سبت) الجاي
const defaultWeek = () => (isWeekend() ? addDays(weekStart(), 7) : weekStart());
const validWeek = (w) => (/^\d{4}-\d{2}-\d{2}$/.test(w || "") && weekStart(w) === w ? w : defaultWeek());

r.get("/plan", loadSubject(), async (req, res) => {
  const week = validWeek(req.query.week);
  if (isParent(req.user.role)) await autoPrepare(req.subject._id).catch(() => 0);
  const plan = await StudyPlan.findOne({ user: req.subject._id, weekStart: week }).lean();
  const books = Object.fromEntries((await Book.find({ user: req.subject._id }).select("subject title").lean()).map((b) => [String(b._id), b]));
  const lessonIds = (plan?.items || []).map((i) => i.lesson).filter(Boolean);
  const lessons = Object.fromEntries((await Lesson.find({ _id: { $in: lessonIds } }).select("stage score mastered").lean()).map((l) => [String(l._id), l]));
  const items = [];
  for (const i of plan?.items || []) {
    const st = i.lesson ? { ready: true, missing: [], noPages: false } : await itemPages(i);
    const b = i.book && books[String(i.book)];
    items.push({ ...i, bookTitle: b?.title || "", ...st, lesson: i.lesson ? { _id: i.lesson, ...(lessons[String(i.lesson)] || {}) } : null });
  }
  res.json({ weekStart: week, days: weekDays(week), thisWeek: weekStart(), today: today(), saved: !!plan, items, ai: aiReady() });
});

// قراءة صور الخطة بالذكاء الاصطناعي ← مسودة (ما بتنحفظ لحد ما الأهل يأكدوا)
r.post("/plan/read", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role) || !req.canEdit) return res.status(403).json({ error: "parents_only" });
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  const images = (Array.isArray(req.body?.images) ? req.body.images : []).slice(0, 3);
  if (!images.length) return res.status(400).json({ error: "bad_image" });
  const week = validWeek(req.body?.weekStart);
  const books = await Book.find({ user: req.subject._id }).lean();
  const out = await readWeeklyPlan({ images, days: weekDays(week), books });
  if (out.error) return res.status(out.error === "bad_image" ? 400 : 502).json(out);
  res.json({ weekStart: week, items: out.items });
});

// حفظ الخطة (بعد المراجعة). البند اللي إله درس بيضل مربوط فيه.
r.put("/plan", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role) || !req.canEdit) return res.status(403).json({ error: "parents_only" });
  const week = validWeek(req.body?.weekStart);
  const days = weekDays(week);
  const bookIds = new Set((await Book.find({ user: req.subject._id }).select("_id").lean()).map((b) => String(b._id)));
  const old = await StudyPlan.findOne({ user: req.subject._id, weekStart: week }).lean();
  const oldById = Object.fromEntries((old?.items || []).map((i) => [String(i._id), i]));
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 60).filter((i) => days.includes(i.day) && String(i.subject || "").trim()).map((i) => {
    const from = +i.from >= 1 ? Math.floor(+i.from) : null;
    let to = from ? Math.max(from, Math.floor(+i.to) || from) : null;
    if (from && to - from > 15) to = from + 15;
    const book = bookIds.has(String(i.book)) ? i.book : null;
    // نفس البند القديم: بالـ id، أو (لو الخطة انصوّرت من جديد) نفس اليوم والكتاب والصفحات
    const prev = (i._id && oldById[String(i._id)]) || (old?.items || []).find((o) => o.day === i.day && String(o.book || "") === String(book || "") && o.from === from && o.to === to);
    // إذا تغيّر الكتاب أو الصفحات أو اليوم، الدرس القديم ما عاد إله
    const same = prev && String(prev.book || "") === String(book || "") && prev.from === from && prev.to === to && prev.day === i.day;
    return { ...(prev ? { _id: prev._id } : {}), day: i.day, subject: String(i.subject).trim().slice(0, 60), topic: String(i.topic || "").slice(0, 160), book, from, to, lesson: same ? prev.lesson : undefined, askedOn: same ? prev.askedOn : undefined };
  });
  await StudyPlan.findOneAndUpdate({ user: req.subject._id, weekStart: week }, { $set: { items } }, { upsert: true });
  // دروس بنود انشالت أو تغيّرت: إذا الولد ما بلّش فيها نحذفها (ما تضل محطة زيادة)
  const kept = new Set(items.map((i) => String(i.lesson || "")));
  const orphans = (old?.items || []).map((i) => i.lesson).filter((id) => id && !kept.has(String(id)));
  if (orphans.length) await Lesson.deleteMany({ _id: { $in: orphans }, user: req.subject._id, stage: "warmup" });
  const prepared = await autoPrepare(req.subject._id).catch(() => 0);
  res.json({ ok: true, prepared });
});

// تحضير درس بند الآن (حتى لو يومه بعدين)
r.post("/plan/item/:itemId/prepare", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const plan = await StudyPlan.findOne({ "items._id": req.params.itemId });
  const kid = plan && (await User.findById(plan.user).lean());
  if (!plan || !kid || !canAccess(req.user, kid).canEdit) return res.status(404).json({ error: "not_found" });
  const item = plan.items.id(req.params.itemId);
  if (item.lesson) return res.json({ _id: item.lesson });
  const st = await itemPages(item);
  if (!st.ready) return res.status(400).json({ error: st.noPages ? "plan_no_pages" : "plan_missing_pages", missing: st.missing });
  const l = await prepareItem(plan, item, kid);
  if (!l) return res.status(409).json({ error: "busy" });
  res.json({ _id: l._id, aiPrepared: l.aiPrepared });
});

export default r;
