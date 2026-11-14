import { Router } from "express";
import { requireAuth, loadSubject, isParent } from "../middleware/auth.js";
import { Book, Page, Lesson } from "../models/index.js";
import { prepareLesson, gradeAnswer, gradeExam } from "../utils/study.js";
import { award } from "../utils/points.js";
import { addDays, today } from "../utils/dates.js";

const r = Router();
r.use(requireAuth);

r.get("/", loadSubject(), async (req, res) => {
  const books = await Book.find({ user: req.subject._id }).lean();
  const lessons = await Lesson.find({ user: req.subject._id }).sort({ createdAt: -1 }).limit(30).lean();
  const done = lessons.filter((l) => l.stage === "done");
  res.json({ books, lessons, mastery: { lessons: done.length, mastered: done.filter((l) => l.mastered).length, avg: done.length ? Math.round(done.reduce((a, l) => a + (l.score || 0), 0) / done.length) : null } });
});
r.post("/book", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { subject, title } = req.body || {};
  res.json(await Book.create({ user: req.subject._id, subject, title, stage: req.subject.grade }));
});
r.post("/book/:bookId/page", async (req, res) => {
  const { number, text, imageUrl } = req.body || {};
  res.json(await Page.create({ book: req.params.bookId, number: +number || 1, text, imageUrl }));
});
// تحضير درس الغد من صفحة (نص الصفحة؛ الصورة تُحوَّل لنص عند ربط LLM)
r.post("/prepare", loadSubject(), async (req, res) => {
  const { bookId, pageNumber, title } = req.body || {};
  const book = await Book.findById(bookId).lean();
  const page = await Page.findOne({ book: bookId, number: +pageNumber }).lean();
  if (!book || !page?.text) return res.status(400).json({ error: "page_text_required" });
  const prep = prepareLesson(title || `${book.title} p.${pageNumber}`, page.text, req.subject.grade || "Stage 4");
  const lesson = await Lesson.create({ user: req.subject._id, book: bookId, forDay: addDays(today(), 1), ...prep });
  res.json(lesson);
});
r.get("/lesson/:id", async (req, res) => {
  const l = await Lesson.findById(req.params.id).lean();
  if (!l) return res.status(404).json({ error: "not_found" });
  res.json(l);
});
r.post("/lesson/:id/start", async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, { $set: { stage: "learn", currentPoint: 0 } }, { new: true })));
r.post("/lesson/:id/point", async (req, res) => {
  const l = await Lesson.findById(req.params.id);
  const p = l.points[l.currentPoint];
  const g = gradeAnswer(p, req.body?.answer);
  if (g.ok) { l.currentPoint += 1; if (l.currentPoint >= l.points.length) l.stage = "exam"; await l.save(); }
  res.json({ ...g, stage: l.stage, currentPoint: l.currentPoint });
});
r.post("/lesson/:id/exam", async (req, res) => {
  const l = await Lesson.findById(req.params.id);
  const g = gradeExam(l.exam, req.body?.answers || []);
  l.score = g.score; l.mastered = g.score >= 90; l.stage = "summary";
  l.summary = `${l.title}: ${l.points.map((p) => p.answer).join(" · ")} — score ${g.score}%`;
  await l.save();
  if (l.mastered) await award(l.user, 20, `إتقان: ${l.title}`, "lesson");
  res.json({ ...g, mastered: l.mastered, summary: l.summary });
});
r.post("/lesson/:id/finish", async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, { $set: { stage: "done" } }, { new: true })));

export default r;
