// تحضير الدرس بقواعد (بدون LLM): نقاط من فقرات الصفحة، سؤال فهم لكل نقطة، واختبار بأسلوب كامبردج
const COMMANDS = ["State", "Describe", "Explain", "Name", "Give one reason why"];
const STOP = new Set(["the", "and", "that", "with", "this", "from", "they", "have", "which", "when", "there", "their", "them", "into", "also", "than", "then", "some", "more", "most", "very", "can", "are", "was", "were", "for", "but", "not", "you", "your", "its"]);

function sentences(text) {
  return (text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
}
function keyword(s) {
  const words = s.replace(/[^A-Za-z\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  return words.sort((a, b) => b.length - a.length)[0] || "it";
}

export function prepareLesson(title, pageText, stage = "Stage 4") {
  const sents = sentences(pageText);
  const maxPoints = stage.startsWith("Stage 4") ? 4 : 6;
  const picked = sents.slice(0, maxPoints);
  const points = picked.map((s) => {
    const k = keyword(s);
    return { text: s, question: `What is the word for "${k.toLowerCase()}" in this sentence? Say it in your own words.`, answer: k, hint: `Look for "${k.slice(0, 2)}…" in the sentence.` };
  });
  const exam = picked.slice(0, Math.min(3, picked.length)).map((s, i) => {
    const k = keyword(s);
    return { command: COMMANDS[i % COMMANDS.length], question: `${COMMANDS[i % COMMANDS.length]} what the text says about ${k.toLowerCase()}.`, keywords: [k.toLowerCase(), ...s.toLowerCase().split(/\s+/).filter((w) => w.length > 5 && !STOP.has(w)).slice(0, 2)], marks: 2 };
  });
  return { title, objective: `Understand: ${title}`, points, exam };
}

export function gradeAnswer(point, answer) {
  const a = (answer || "").toLowerCase();
  const ok = a.includes(point.answer.toLowerCase()) || a.split(/\s+/).length >= 4;
  return { ok, feedback: ok ? "Good. Next point." : `Not yet. Hint: ${point.hint}` };
}
export function gradeExam(exam, answers) {
  let got = 0, total = 0; const detail = [];
  exam.forEach((q, i) => {
    const a = (answers[i] || "").toLowerCase();
    const hits = q.keywords.filter((k) => a.includes(k)).length;
    const m = Math.min(q.marks, hits); got += m; total += q.marks;
    detail.push({ question: q.question, marks: m, of: q.marks, missing: q.keywords.filter((k) => !a.includes(k)) });
  });
  return { score: total ? Math.round((100 * got) / total) : 0, detail };
}
