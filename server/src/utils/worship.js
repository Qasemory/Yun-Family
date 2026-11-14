import { PrayerLog, User } from "../models/index.js";
import { today, addDays } from "./dates.js";
import { award, notifyParents } from "./points.js";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
export const PRAYER_AR = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
export const POINTS = { fajr: { mosque: 25, ontime: 15, late: 5 }, other: { mosque: 10, ontime: 5, late: 2 } };
export const FULL_DAY_BONUS = 10;
export const FAJR_STREAK_BONUS = { 7: 50, 30: 200 };
export const DHIKR = {
  morning: ["أصبحنا وأصبح الملك لله", "اللهم بك أصبحنا وبك أمسينا", "سيد الاستغفار", "آية الكرسي", "المعوذات ٣ مرات", "رضيت بالله رباً"],
  evening: ["أمسينا وأمسى الملك لله", "اللهم بك أمسينا وبك أصبحنا", "سيد الاستغفار", "آية الكرسي", "المعوذات ٣ مرات", "أعوذ بكلمات الله التامات"],
  sleep: ["باسمك اللهم أموت وأحيا", "آية الكرسي", "المعوذات", "اللهم قني عذابك يوم تبعث عبادك"],
};

export async function logPrayer(user, prayer, status, day = today()) {
  if (!PRAYERS.includes(prayer) || !POINTS.other[status]) return { ok: false, reason: "bad_input" };
  const table = prayer === "fajr" ? POINTS.fajr : POINTS.other;
  const pts = table[status];
  const isChild = ["child", "teen_adult"].includes(user.role);
  const confirmed = !(isChild && prayer === "fajr");          // فجر الولد ينتظر تأكيد الأهل
  const existing = await PrayerLog.findOne({ user: user._id, day, prayer });
  if (existing) return { ok: true, already: true, points: 0 };
  await PrayerLog.create({ user: user._id, day, prayer, status, points: pts, confirmed });
  let awarded = 0;
  if (confirmed) { await award(user._id, pts, `صلاة ${PRAYER_AR[prayer]} (${status})`, "prayer", day); awarded = pts; }
  else await notifyParents(user.family, "confirm", `${user.displayName} قال إنه صلى الفجر (${status}). أكّد من صفحته.`);
  // يوم كامل
  const count = await PrayerLog.countDocuments({ user: user._id, day, confirmed: true });
  if (confirmed && count === 5) { await award(user._id, FULL_DAY_BONUS, "الصلوات الخمس في يوم", "prayer_full", day); awarded += FULL_DAY_BONUS; }
  return { ok: true, points: awarded, pending: !confirmed };
}

export async function confirmFajr(parent, childId, day = today()) {
  const log = await PrayerLog.findOne({ user: childId, day, prayer: "fajr", confirmed: false });
  if (!log) return { ok: false };
  log.confirmed = true; await log.save();
  await award(childId, log.points, `صلاة الفجر (${log.status})`, "prayer", day);
  const streak = await fajrStreak(childId, day);
  const bonus = FAJR_STREAK_BONUS[streak];
  if (bonus) await award(childId, bonus, `سلسلة فجر ${streak} يوم`, "fajr_streak", day);
  return { ok: true, points: log.points + (bonus || 0), streak };
}

export async function fajrStreak(userId, day = today()) {
  let n = 0, d = day;
  for (let i = 0; i < 400; i++) {
    const ok = await PrayerLog.exists({ user: userId, day: d, prayer: "fajr", confirmed: true });
    if (!ok) break;
    n++; d = addDays(d, -1);
  }
  return n;
}

export async function dayBoard(userId, day = today()) {
  const logs = await PrayerLog.find({ user: userId, day }).lean();
  const by = Object.fromEntries(logs.map((l) => [l.prayer, l]));
  return PRAYERS.map((p) => ({ prayer: p, name: PRAYER_AR[p], status: by[p]?.status || null, confirmed: by[p]?.confirmed ?? null, points: by[p]?.points || 0 }));
}

export async function familyFajrBoard(familyId, day = today()) {
  const members = await User.find({ family: familyId, isActive: true, role: { $in: ["owner", "admin", "child", "teen_adult"] } }).lean();
  const out = [];
  for (const m of members) {
    const log = await PrayerLog.findOne({ user: m._id, day, prayer: "fajr" }).lean();
    out.push({ userId: m._id, name: m.displayName, color: m.color, status: log?.status || null, confirmed: log?.confirmed ?? null, streak: await fajrStreak(m._id, day) });
  }
  return out;
}
