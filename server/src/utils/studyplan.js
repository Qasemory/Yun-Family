// الخطة الأسبوعية: نجهّز درس كل يوم من صفحاته المحفوظة، وإذا ناقصة نذكّر الأهل يصوّروها
import { StudyPlan, Page, Book, Lesson, User } from "../models/index.js";
import { prepareLesson } from "./study.js";
import { notifyParents } from "./notify.js";
import { today, addDays, nowHM } from "./dates.js";

export const EVENING = "19:00";
export const SCHOOL_DAYS = 5; // الأحد ← الخميس
export const weekDays = (weekStart) => Array.from({ length: SCHOOL_DAYS }, (_, i) => addDays(weekStart, i));
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** شو ناقص من صفحات هالبند؟ */
export async function itemPages(item) {
  if (!item.book || !item.from) return { ready: false, missing: [], noPages: true };
  const want = range(item.from, item.to || item.from);
  const have = await Page.find({ book: item.book, number: { $in: want }, text: { $nin: [null, ""] } }).select("number").lean();
  const got = new Set(have.map((p) => p.number));
  const missing = want.filter((n) => !got.has(n));
  return { ready: missing.length === 0, missing, noPages: false };
}

const locks = new Set(); // ما نحضّر نفس البند مرتين بنفس الوقت
/** تحضير درس البند من صفحاته (لازم تكون كاملة) */
export async function prepareItem(plan, item, kid) {
  const key = String(item._id);
  if (item.lesson || locks.has(key)) return null;
  locks.add(key);
  try {
    const book = await Book.findById(item.book).lean();
    if (!book) return null;
    const to = item.to || item.from;
    const pages = await Page.find({ book: book._id, number: { $gte: item.from, $lte: to } }).sort({ number: 1 }).lean();
    const text = pages.map((p) => `--- page ${p.number} ---\n${p.text}`).join("\n\n");
    if (!text.trim()) return null;
    const pagesLabel = to > item.from ? `pp.${item.from}-${to}` : `p.${item.from}`;
    const title = `${item.subject || book.subject}: ${item.topic || book.title} (${pagesLabel})`.slice(0, 160);
    const prep = await prepareLesson(title, text, kid.grade || "Stage 4");
    const lesson = await Lesson.create({ user: kid._id, book: book._id, forDay: item.day, pages: { from: item.from, to }, ...prep });
    // نحفظ الرابط على البند بشكل ذرّي (الخطة ممكن انحفظت بالنص)
    await StudyPlan.updateOne({ _id: plan._id, "items._id": item._id }, { $set: { "items.$.lesson": lesson._id } });
    item.lesson = lesson._id;
    return lesson;
  } finally { locks.delete(key); }
}

/** نحضّر دروس اليوم وبكرا إذا صفحاتها صارت جاهزة. يرجع عدد الدروس الجديدة. */
export async function autoPrepare(userId, { notifyReady = false } = {}) {
  const t = today(), tm = addDays(t, 1);
  const plans = await StudyPlan.find({ user: userId, "items.day": { $in: [t, tm] } });
  if (!plans.length) return 0;
  const kid = await User.findById(userId).lean();
  if (!kid) return 0;
  let made = 0;
  for (const plan of plans) {
    for (const item of plan.items) {
      if (![t, tm].includes(item.day) || item.lesson) continue;
      if (!(await itemPages(item)).ready) continue;
      const l = await prepareItem(plan, item, kid);
      if (l) {
        made++;
        if (notifyReady) await notifyParents(kid.family, "study", `✅ درس ${item.subject} عند ${kid.displayName} ${item.day === t ? "لليوم" : "لبكرا"} جاهز (من الخطة الأسبوعية).`);
      }
    }
  }
  return made;
}

/** فحص المسا: درس بكرا جاهز؟ وإلا نطلب تصوير الصفحات (مرة وحدة باليوم لكل بند) */
export async function eveningCheck() {
  const t = today(), tm = addDays(t, 1);
  const plans = await StudyPlan.find({ "items.day": tm });
  for (const plan of plans) {
    const kid = await User.findById(plan.user).lean();
    if (!kid || kid.isActive === false) continue;
    for (const item of plan.items) {
      if (item.day !== tm || item.lesson) continue;
      const st = await itemPages(item);
      if (st.ready) {
        const l = await prepareItem(plan, item, kid).catch((e) => { console.error("plan prepare", e.message); return null; });
        if (l) await notifyParents(kid.family, "study", `✅ درس ${item.subject} لبكرا عند ${kid.displayName} جاهز.`);
        continue;
      }
      if (item.askedOn === t) continue;
      const what = st.noPages
        ? `حدّد صفحات «${item.topic || item.subject}» أو صوّرها`
        : `صوّر ${st.missing.length === 1 ? `صفحة ${st.missing[0]}` : `الصفحات ${st.missing.join("، ")}`}`;
      await notifyParents(kid.family, "study", `📚 بكرا عند ${kid.displayName}: ${item.subject}${item.topic ? ` (${item.topic})` : ""}. ${what} من «الدراسة ← الخطة» والدرس بيتحضّر لحاله.`);
      await StudyPlan.updateOne({ _id: plan._id, "items._id": item._id }, { $set: { "items.$.askedOn": t } });
    }
  }
}

/** Render المجاني بينام: إذا صحي بعد السابعة مسا وما انعمل الفحص، نعمله (askedOn بيمنع التكرار) */
export async function eveningCatchUp() {
  if (nowHM() >= EVENING) await eveningCheck().catch((e) => console.error("evening check", e.message));
}
