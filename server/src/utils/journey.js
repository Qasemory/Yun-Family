// رحلة المهام: قطار اليوم، نجوم الأسبوع، السلسلة (مع يوم سماح أسبوعي)، الشارات، وقطار العيلة
import { Task, Completion, PointsLedger, PrayerLog, Lesson, Redemption, Badge, User } from "../models/index.js";
import { today, addDays, weekday, weekStart } from "./dates.js";
import { award } from "./points.js";
import { notify, notifyParents } from "./notify.js";
import { getSettings } from "./settings.js";

const LOOKBACK = 90;

/** حالة الأيام من الذاكرة (استعلامين فقط بدل استعلام لكل يوم) */
async function dayStatuses(userId, from, to) {
  const tasks = await Task.find({ user: userId }).select("_id days mandatory active createdAt").lean();
  const comps = await Completion.find({ user: userId, status: "done", day: { $gte: from, $lte: to } }).select("task day").lean();
  const doneBy = {};
  for (const c of comps) (doneBy[c.day] ||= new Set()).add(String(c.task));
  return (day) => {
    const planned = tasks.filter((t) => (t.active || doneBy[day]?.has(String(t._id))) && (t.days || []).includes(weekday(day)) && today(t.createdAt) <= day);
    const done = doneBy[day] || new Set();
    if (!planned.length) return { status: "rest", done: 0, total: 0 };
    const mand = planned.filter((t) => t.mandatory);
    const n = planned.filter((t) => done.has(String(t._id))).length;
    const ok = mand.length ? mand.every((t) => done.has(String(t._id))) : n * 2 >= planned.length;
    return { status: ok ? "star" : "missed", done: n, total: planned.length };
  };
}

/** السلسلة: أيام مكتملة متتالية، يوم واحد فائت بالأسبوع ما بيكسرها، وأيام الراحة ما بتحسب */
export async function journeyStreak(userId, day = today()) {
  const from = addDays(day, -LOOKBACK);
  const st = await dayStatuses(userId, from, day);
  let n = 0;
  const graceUsed = new Set();
  for (let i = 0; i <= LOOKBACK; i++) {
    const d = addDays(day, -i);
    const s = st(d).status;
    if (s === "star") { n++; continue; }
    if (s === "rest" || i === 0) continue;            // اليوم لسا ما خلص
    const wk = weekStart(d);
    if (!graceUsed.has(wk)) { graceUsed.add(wk); continue; }
    break;
  }
  return { streak: n, graceLeft: graceUsed.has(weekStart(day)) ? 0 : 1 };
}

export async function weekView(userId, day = today()) {
  const start = weekStart(day);
  const st = await dayStatuses(userId, start, addDays(start, 6));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const s = st(d);
    return { day: d, ...s, status: d > day ? "future" : d === day && s.status !== "star" ? "today" : s.status };
  });
}

// ---------- الشارات ----------
export const BADGES = [
  { key: "first_task", icon: "🚂", ar: "أول محطة", en: "First stop", descAr: "أول مهمة خلصتها", descEn: "Your first finished task" },
  { key: "streak3", icon: "🔥", ar: "٣ أيام ورا بعض", en: "3-day streak", descAr: "وصلت لآخر المحطات ٣ أيام", descEn: "Reached the last stop 3 days in a row" },
  { key: "streak7", icon: "⭐", ar: "أسبوع كامل", en: "Full week", descAr: "سلسلة ٧ أيام", descEn: "A 7-day streak" },
  { key: "streak30", icon: "🏆", ar: "بطل الشهر", en: "Month champion", descAr: "سلسلة ٣٠ يوم", descEn: "A 30-day streak" },
  { key: "fajr7", icon: "🌅", ar: "فجر ٧ أيام", en: "Fajr ×7", descAr: "صليت الفجر ٧ أيام ورا بعض", descEn: "Prayed Fajr 7 days in a row" },
  { key: "quran30", icon: "📖", ar: "صاحب القرآن", en: "Quran friend", descAr: "قرآن بـ ٣٠ يوم", descEn: "Quran on 30 days" },
  { key: "mastered1", icon: "🎓", ar: "أول درس متقن", en: "First mastered lesson", descAr: "أتقنت أول درس", descEn: "Mastered your first lesson" },
  { key: "mastered5", icon: "🧠", ar: "٥ دروس متقنة", en: "5 mastered lessons", descAr: "أتقنت ٥ دروس", descEn: "Mastered 5 lessons" },
  { key: "helper10", icon: "🧹", ar: "إيد البيت", en: "Home helper", descAr: "١٠ مهام بيت", descEn: "10 home tasks" },
  { key: "sport10", icon: "⚽", ar: "رياضي", en: "Sporty", descAr: "١٠ مرات رياضة", descEn: "10 sport sessions" },
  { key: "points500", icon: "💎", ar: "٥٠٠ نقطة", en: "500 points", descAr: "جمعت ٥٠٠ نقطة", descEn: "Earned 500 points" },
  { key: "first_reward", icon: "🎟️", ar: "أول مكافأة", en: "First reward", descAr: "استلمت أول مكافأة", descEn: "Got your first reward" },
];
const BADGE_POINTS = 10;

async function countDomainDone(userId, domainKey, distinctDays = false) {
  const ids = (await Task.find({ user: userId, domainKey }).select("_id").lean()).map((t) => t._id);
  if (!ids.length) return 0;
  if (distinctDays) return (await Completion.distinct("day", { user: userId, status: "done", task: { $in: ids } })).length;
  return Completion.countDocuments({ user: userId, status: "done", task: { $in: ids } });
}
async function fajrRun(userId, day) {
  const days = new Set(await PrayerLog.distinct("day", { user: userId, prayer: "fajr", day: { $gte: addDays(day, -40) } }));
  let n = 0, d = days.has(day) ? day : addDays(day, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** يفحص الشارات ويعطي الجديد منها (+١٠ وإشعار) */
export async function checkBadges(user, day = today()) {
  const have = new Set((await Badge.find({ user: user._id }).select("key").lean()).map((b) => b.key));
  const missing = BADGES.filter((b) => !have.has(b.key));
  if (!missing.length) return [];
  const need = (k) => missing.some((b) => b.key === k);
  const earned = [];
  const add = (k) => earned.push(k);
  if (need("first_task") && (await Completion.exists({ user: user._id, status: "done" }))) add("first_task");
  if (need("streak3") || need("streak7") || need("streak30")) {
    const { streak } = await journeyStreak(user._id, day);
    if (streak >= 3) add("streak3"); if (streak >= 7) add("streak7"); if (streak >= 30) add("streak30");
  }
  if (need("fajr7") && (await fajrRun(user._id, day)) >= 7) add("fajr7");
  if (need("quran30") && (await countDomainDone(user._id, "quran", true)) >= 30) add("quran30");
  if (need("mastered1") || need("mastered5")) {
    const m = await Lesson.countDocuments({ user: user._id, mastered: true });
    if (m >= 1) add("mastered1"); if (m >= 5) add("mastered5");
  }
  if (need("helper10") && (await countDomainDone(user._id, "home")) >= 10) add("helper10");
  if (need("sport10") && (await countDomainDone(user._id, "sport")) >= 10) add("sport10");
  if (need("points500")) {
    const r = await PointsLedger.aggregate([{ $match: { user: user._id, delta: { $gt: 0 } } }, { $group: { _id: null, s: { $sum: "$delta" } } }]);
    if ((r[0]?.s || 0) >= 500) add("points500");
  }
  if (need("first_reward") && (await Redemption.exists({ user: user._id, status: "approved" }))) add("first_reward");
  const fresh = [];
  for (const k of earned.filter((k) => !have.has(k))) {
    try { await Badge.create({ user: user._id, key: k, day }); } catch { continue; } // سباق: انعطت قبل شوي
    const b = BADGES.find((x) => x.key === k);
    fresh.push(k);
    await award(user._id, BADGE_POINTS, `شارة: ${b.ar}`, `badge:${k}`, day);
    await notify(user, "badge", `${b.icon} شارة جديدة: ${b.ar}! (+${BADGE_POINTS})`);
    await notifyParents(user.family, "badge", `${b.icon} ${user.displayName} أخذ شارة «${b.ar}».`);
  }
  return fresh;
}

// ---------- قطار العيلة: هدف شهري مشترك من نقاط مهام الأولاد ----------
export async function familyTrain(familyId, day = today()) {
  const s = await getSettings(familyId);
  const target = Number(s.family_goal_target || 0);
  const title = s.family_goal_title || "";
  const month = day.slice(0, 7);
  if (!target || !title) return { enabled: false, month };
  const kids = await User.find({ family: familyId, role: { $in: ["child", "teen_adult"] }, isActive: true }).select("_id displayName color").lean();
  const rows = await PointsLedger.aggregate([
    { $match: { user: { $in: kids.map((k) => k._id) }, delta: { $gt: 0 }, ref: { $regex: "^task:" }, day: { $regex: `^${month}` } } },
    { $group: { _id: "$user", s: { $sum: "$delta" } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [String(r._id), r.s]));
  const progress = rows.reduce((a, r) => a + r.s, 0);
  return { enabled: true, month, title, target, progress, pct: Math.min(100, Math.round((100 * progress) / target)), reached: progress >= target, kids: kids.map((k) => ({ id: k._id, name: k.displayName, color: k.color, points: by[String(k._id)] || 0 })) };
}
