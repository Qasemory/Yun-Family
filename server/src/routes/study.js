import { Router } from "express";
import { requireAuth, loadSubject, isParent } from "../middleware/auth.js";
import { Book, Page, Lesson, User } from "../models/index.js";
import { prepareLesson, gradeAnswer, gradeExam, explainAgain, pageImageToText } from "../utils/study.js";
import { aiReady } from "../utils/ai.js";
import { award } from "../utils/points.js";
import { checkBadges } from "../utils/journey.js";
import { addDays, today } from "../utils/dates.js";

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

r.get("/", loadSubject(), async (req, res) => {
  const books = await Book.find({ user: req.subject._id }).lean();
  const lessons = await Lesson.find({ user: req.subject._id }).sort({ createdAt: -1 }).limit(30).lean();
  const done = lessons.filter((l) => l.stage === "done");
  const reviewable = lessons.filter((l) => l.stage === "done" && !l.reviewed && !l.isReview && l.mistakes?.length).reduce((a, l) => a + l.mistakes.length, 0);
  const parent = isParent(req.user.role);
  res.json({
    ai: aiReady(), reviewable,
    books,
    lessons: lessons.map((l) => ({ _id: l._id, title: l.title, forDay: l.forDay, stage: l.stage, score: l.score, mastered: l.mastered, isReview: l.isReview, points: l.points.map(() => 0), parentNote: parent ? l.parentNote : undefined })),
    mastery: { lessons: done.length, mastered: done.filter((l) => l.mastered).length, avg: done.length ? Math.round(done.reduce((a, l) => a + (l.score || 0), 0) / done.length) : null },
  });
});
r.post("/book", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { subject, title } = req.body || {};
  res.json(await Book.create({ user: req.subject._id, subject, title, stage: req.subject.grade }));
});
r.post("/book/:bookId/page", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { number, text } = req.body || {};
  const page = await Page.findOneAndUpdate({ book: req.params.bookId, number: +number || 1 }, { $set: { text } }, { new: true, upsert: true });
  res.json(page);
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
  const book = await Book.findById(bookId).lean();
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

export default r;
