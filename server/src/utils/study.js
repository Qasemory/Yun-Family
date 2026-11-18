// الدراسة: Claude يحضّر ويشرح ويصحّح. بدون مفتاح AI نرجع لقواعد بسيطة (احتياط).
import { askJSON, imageBlock, S } from "./ai.js";

const COMMANDS = ["State", "Describe", "Explain", "Name", "Give one reason why"];
const STOP = new Set(["the", "and", "that", "with", "this", "from", "they", "have", "which", "when", "there", "their", "them", "into", "also", "than", "then", "some", "more", "most", "very", "can", "are", "was", "were", "for", "but", "not", "you", "your", "its"]);
const isYoung = (stage = "") => stage.startsWith("Stage 4");

const tutor = (stage) => `You are a warm, patient Cambridge Primary tutor for a ${isYoung(stage) ? "9-year-old (Cambridge Stage 4)" : "12-year-old (Cambridge Stage 7)"} child in Jordan whose first language is Arabic.
Lesson content is always in simple English at the child's level (short sentences, everyday words). Arabic help is short, friendly Jordanian/standard Arabic for a child.
Never invent facts that are not supported by the page. Keep a kind, encouraging tone; never shame the child.`;

// ---------- قراءة صورة صفحة الكتاب ----------
export async function pageImageToText(dataUrl) {
  const img = imageBlock(dataUrl);
  if (!img) return { error: "bad_image" };
  const out = await askJSON({
    tag: "ocr",
    system: "You transcribe school textbook pages accurately.",
    content: [img, { type: "text", text: "Transcribe all the readable lesson text on this textbook page, in reading order. Keep headings on their own lines. For each picture, diagram or table, add one short line in square brackets describing what it shows (e.g. [Diagram: parts of a plant]). Skip page numbers, headers and footers. If there is no readable text, return an empty string." }],
    schema: S.obj({ text: S.str() }),
    maxTokens: 6000,
  });
  if (!out) return { error: "ai_unavailable" };
  return { text: (out.text || "").trim() };
}

// ---------- تحضير الدرس ----------
const LESSON_SCHEMA = S.obj({
  objective: S.str(),
  points: S.arr(S.obj({ text: S.str(), explain: S.str(), example: S.str(), ar: S.str(), question: S.str(), answer: S.str(), hint: S.str() })),
  exam: S.arr(S.obj({ command: S.str(), question: S.str(), modelAnswer: S.str(), keywords: S.arr(S.str()), marks: S.int() })),
});

export async function prepareLesson(title, pageText, stage = "Stage 4") {
  const n = isYoung(stage) ? "3-4" : "4-6";
  const ai = await askJSON({
    tag: "prepare", effort: "medium", maxTokens: 12000,
    system: tutor(stage),
    content: `Prepare tomorrow's lesson from this textbook page.\nTitle: ${title}\n\n<page>\n${pageText}\n</page>\n\nReturn:
- objective: one sentence starting "I can ...".
- points: ${n} key ideas from the page, in order. For each: text = the key idea in 1-2 short sentences close to the book; explain = a simpler explanation in 2-3 short sentences; example = one everyday example a child knows; ar = the same idea explained in 1-2 short Arabic sentences; question = one comprehension question that checks understanding (not just copying a word); answer = a short model answer; hint = a gentle hint that does not give the answer away.
- exam: 3 Cambridge-style questions using command words (State, Name, Describe, Explain, Give one reason why). keywords = 2-4 lowercase words a good answer should contain; marks = 1 or 2; modelAnswer = a full-mark answer.`,
    schema: LESSON_SCHEMA,
  });
  if (ai?.points?.length) {
    return { title, objective: ai.objective, points: ai.points, exam: ai.exam.map((q) => ({ ...q, marks: Math.min(2, Math.max(1, q.marks || 1)), keywords: q.keywords.map((k) => k.toLowerCase()) })), aiPrepared: true };
  }
  return ruleLesson(title, pageText, stage);
}

function sentences(text) {
  return (text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
}
function keyword(s) {
  const words = s.replace(/[^A-Za-z\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  return words.sort((a, b) => b.length - a.length)[0] || "it";
}
function ruleLesson(title, pageText, stage) {
  const picked = sentences(pageText).slice(0, isYoung(stage) ? 4 : 6);
  const points = picked.map((s) => {
    const k = keyword(s);
    return { text: s, explain: "", example: "", ar: "", question: `What does the sentence say about "${k.toLowerCase()}"? Say it in your own words.`, answer: k, hint: `Look for "${k.slice(0, 2)}…" in the sentence.` };
  });
  const exam = picked.slice(0, Math.min(3, picked.length)).map((s, i) => {
    const k = keyword(s);
    return { command: COMMANDS[i % COMMANDS.length], question: `${COMMANDS[i % COMMANDS.length]} what the text says about ${k.toLowerCase()}.`, modelAnswer: s, keywords: [k.toLowerCase(), ...s.toLowerCase().split(/\s+/).filter((w) => w.length > 5 && !STOP.has(w)).slice(0, 2)], marks: 2 };
  });
  return { title, objective: `Understand: ${title}`, points, exam, aiPrepared: false };
}

// ---------- تصحيح جواب نقطة ----------
export async function gradeAnswer(point, answer, stage, attempt = 1) {
  const a = (answer || "").trim();
  if (!a) return { ok: false, feedback: "Write your answer first." };
  const ai = await askJSON({
    tag: "grade",
    system: tutor(stage),
    content: `Key idea: ${point.text}\nQuestion: ${point.question}\nModel answer: ${point.answer}\nChild's answer (attempt ${attempt}): ${a}\n\nIs the child's answer correct in meaning? Accept their own words, small spelling or grammar mistakes, and partial answers that show the main idea. feedback: 1-2 short, kind English sentences — if correct, say what was good; if not, give a hint without revealing the answer. ar: the same feedback in short Arabic.`,
    schema: S.obj({ ok: S.bool(), feedback: S.str(), ar: S.str() }),
    maxTokens: 2000,
  });
  if (ai) return ai;
  // احتياط: لازم الكلمة المفتاحية أو أغلب كلمات الجواب النموذجي
  const al = a.toLowerCase();
  const target = (point.answer || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w));
  const hits = target.filter((w) => al.includes(w)).length;
  const ok = al.includes((point.answer || "").toLowerCase()) || (target.length > 0 && hits / target.length >= 0.5);
  return { ok, feedback: ok ? "Good. Next point." : `Not yet. Hint: ${point.hint}`, ar: "" };
}

// ---------- اشرحلي كمان مرة ----------
export async function explainAgain(point, stage, question = "") {
  const ai = await askJSON({
    tag: "explain",
    system: tutor(stage),
    content: `The child did not understand this idea yet:\n${point.text}\n${point.explain ? `Earlier explanation: ${point.explain}\n` : ""}${question ? `The child asks: ${question}\n` : ""}\nExplain it again in a different, simpler way, with a new everyday example. text: 2-4 short English sentences. ar: the same in 2-3 short Arabic sentences. Do not give the answer to the question "${point.question}" directly.`,
    schema: S.obj({ text: S.str(), ar: S.str() }),
    maxTokens: 2000,
  });
  return ai || { text: point.explain || point.hint || point.text, ar: point.ar || "" };
}

// ---------- تصحيح الاختبار + الملخص + تقرير الأهل ----------
export async function gradeExam(lesson, answers, stage) {
  const ai = await askJSON({
    tag: "exam", effort: "medium", maxTokens: 6000,
    system: tutor(stage),
    content: `Mark this Cambridge-style quiz for the lesson "${lesson.title}". Be fair: accept the child's own words and ignore spelling.\n\n${lesson.exam.map((q, i) => `Q${i + 1} [${q.marks} marks] ${q.command}: ${q.question}\nModel answer: ${q.modelAnswer || q.keywords.join(", ")}\nChild: ${answers[i] || "(no answer)"}`).join("\n\n")}\n\nKey ideas of the lesson:\n${lesson.points.map((p, i) => `${i + 1}. ${p.text}`).join("\n")}\n\nReturn: detail = one item per question with marks (0..max) and feedback (one short English sentence: what was good or what was missing). summary = 2-3 short English sentences summarising what the lesson taught, for the child. parentNote = 2-3 short Arabic sentences for the parents: what the child understood well, what needs more practice, and one practical tip for home.`,
    schema: S.obj({ detail: S.arr(S.obj({ marks: S.int(), feedback: S.str() })), summary: S.str(), parentNote: S.str() }),
  });
  let got = 0, total = 0;
  const detail = lesson.exam.map((q, i) => {
    total += q.marks;
    if (ai?.detail?.[i]) {
      const m = Math.min(q.marks, Math.max(0, ai.detail[i].marks));
      got += m;
      return { question: q.question, marks: m, of: q.marks, feedback: ai.detail[i].feedback, missing: [] };
    }
    const a = (answers[i] || "").toLowerCase();
    const missing = q.keywords.filter((k) => !a.includes(k));
    const m = Math.min(q.marks, q.keywords.length - missing.length);
    got += m;
    return { question: q.question, marks: m, of: q.marks, feedback: "", missing };
  });
  return {
    score: total ? Math.round((100 * got) / total) : 0,
    detail,
    summary: ai?.summary || `${lesson.title}: ${lesson.points.map((p) => p.answer).join(" · ")}`,
    parentNote: ai?.parentNote || "",
  };
}

// ---------- الفهرس: صورة أو نص ← وحدات ودروس مع أرقام صفحاتها ----------
export async function readToc({ image, text }) {
  const img = image ? imageBlock(image) : null;
  if (image && !img) return { error: "bad_image" };
  if (!img && !text) return { error: "nothing" };
  const ask = "This is the contents page of a school textbook. List every unit and lesson/topic with the page number where it starts, in order. title = the heading as printed (keep unit numbers like \"Unit 3\" or \"3.2\"). page = the start page as an integer. Skip entries with no page number.";
  const out = await askJSON({
    tag: "toc", maxTokens: 6000,
    system: "You read textbook contents pages accurately.",
    content: img ? [img, { type: "text", text: ask }] : `${ask}\n\n<contents>\n${String(text).slice(0, 15000)}\n</contents>`,
    schema: S.obj({ entries: S.arr(S.obj({ title: S.str(), page: S.int() })) }),
  });
  if (!out) return { error: "ai_unavailable" };
  const toc = out.entries.filter((e) => e.title && e.page > 0 && e.page < 2000).map((e) => ({ title: e.title.trim().slice(0, 160), page: e.page }));
  return { toc };
}

// ---------- الخطة الأسبوعية: صور الخطة ← بنود لكل يوم ----------
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export async function readWeeklyPlan({ images, days, books }) {
  const blocks = (images || []).map(imageBlock);
  if (!blocks.length || blocks.some((b) => !b)) return { error: "bad_image" };
  const bookList = books.map((b) => `- id=${b._id} | subject: ${b.subject} | title: ${b.title}${b.toc?.length ? `\n  contents: ${b.toc.map((e) => `${e.title} (p.${e.page})`).join("; ").slice(0, 3000)}` : ""}`).join("\n");
  const dayList = days.map((d) => `${DAY_EN[new Date(d + "T12:00:00Z").getUTCDay()]} = ${d}`).join(", ");
  const out = await askJSON({
    tag: "plan", effort: "medium", maxTokens: 8000,
    system: "You read school weekly plans (often a table in English and/or Arabic) for parents in Jordan. Be accurate; never invent lessons that are not on the plan.",
    content: [...blocks, { type: "text", text: `These images are one child's school weekly plan.
The school days this week: ${dayList}.
The child's textbooks:
${bookList || "(none added yet)"}

Return one item for each lesson on the plan that uses textbook content (skip breaks, PE, assemblies, and items with no content to study).
- day: one of the dates above.
- subject: the subject name as on the plan (short).
- bookId: the id of the matching textbook from the list, or "" if none matches.
- from / to: the textbook page range if the plan gives pages (to = from for one page). If the plan gives only a unit or topic and that book has contents, use the contents to work out the start page of that topic and the page before the next topic; otherwise 0.
- topic: the unit/lesson title or what the plan says, short.` }],
    schema: S.obj({ items: S.arr(S.obj({ day: S.str(), subject: S.str(), bookId: S.str(), from: S.int(), to: S.int(), topic: S.str() })) }),
  });
  if (!out) return { error: "ai_unavailable" };
  const ids = new Set(books.map((b) => String(b._id)));
  const items = out.items.filter((i) => days.includes(i.day)).map((i) => {
    const from = i.from > 0 ? i.from : null;
    const to = from ? Math.max(from, i.to > 0 ? i.to : from) : null;
    return { day: i.day, subject: i.subject.slice(0, 60), book: ids.has(i.bookId) ? i.bookId : null, from, to: from && to - from > 15 ? from + 15 : to, topic: i.topic.slice(0, 160) };
  });
  return { items };
}
