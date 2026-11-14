// فحص الأحد: الوزن والاتجاه والرسائل والنطاق الصحي وربط الميزان
import crypto from "node:crypto";
import { HealthLog, HealthGoal, ScaleLink, User, Completion, Task, Notification } from "../models/index.js";
import { today, weekStart, addDays, ageOn } from "./dates.js";
import { award } from "./points.js";
import { isParent, isChild } from "../middleware/auth.js";

export const CHECKIN_POINTS = 10;
// WHO 2007 BMI-for-age (تقريبي بالسنوات): [-2SD, median, +1SD, +2SD]
const WHO = {
  f: { 8: [12.9, 15.9, 17.7, 20.3], 9: [13.1, 16.4, 18.3, 21.1], 10: [13.5, 16.9, 19.0, 22.1], 11: [13.9, 17.6, 19.9, 23.1], 12: [14.4, 18.3, 20.8, 24.2], 13: [14.9, 19.0, 21.8, 25.3], 14: [15.4, 19.6, 22.6, 26.3], 15: [15.9, 20.2, 23.3, 27.0] },
  m: { 8: [13.0, 15.7, 17.4, 19.7], 9: [13.2, 16.0, 17.9, 20.5], 10: [13.5, 16.4, 18.5, 21.4], 11: [13.8, 16.9, 19.2, 22.5], 12: [14.3, 17.5, 19.9, 23.6], 13: [14.8, 18.2, 20.8, 24.8], 14: [15.4, 19.0, 21.8, 25.9], 15: [15.9, 19.8, 22.7, 27.0] },
};
const ZONE_AR = { under: "أقل من النطاق", healthy: "النطاق الصحي", above: "فوق النطاق", well_above: "فوق النطاق بوضوح" };
const ZONE_EN = { under: "below range", healthy: "healthy range", above: "above range", well_above: "well above range" };

export const bmi = (w, h) => (w && h ? +(w / ((h / 100) ** 2)).toFixed(1) : null);
export function zoneForChild(b, sex, age) {
  if (b == null || !WHO[sex] || age == null) return null;
  const a = Math.min(Math.max(age, 8), 15);
  const [lo2, med, hi1, hi2] = WHO[sex][a];
  const z = b < lo2 ? "under" : b < hi1 ? "healthy" : b < hi2 ? "above" : "well_above";
  return { zone: z, labelAr: ZONE_AR[z], labelEn: ZONE_EN[z], ref: { low: lo2, median: med, high: hi1, veryHigh: hi2 }, approx: true };
}
export function zoneForAdult(b) {
  if (b == null) return null;
  const z = b < 18.5 ? "under" : b < 25 ? "healthy" : b < 30 ? "above" : "well_above";
  return { zone: z, labelAr: ZONE_AR[z], labelEn: ZONE_EN[z], ref: { low: 18.5, high: 25, veryHigh: 30 }, approx: false };
}

export async function logMeasure(actor, subject, metric, value, { day = today(), source = "manual" } = {}) {
  if (isChild(subject.role) && source !== "scale" && !(actor && isParent(actor.role))) return { ok: false, reason: "child_needs_parent" };
  if (metric === "weight" && !(value >= 10 && value <= 300)) return { ok: false, reason: "out_of_range" };
  const ws = weekStart(day), we = addDays(ws, 6);
  const firstThisWeek = metric === "weight" && !(await HealthLog.exists({ user: subject._id, metric: "weight", day: { $gte: ws, $lte: we } }));
  await HealthLog.updateOne({ user: subject._id, day, metric }, { $set: { value, note: source } }, { upsert: true });
  let points = 0;
  if (firstThisWeek) { points = CHECKIN_POINTS; await award(subject._id, points, "فحص الأحد: سجّلت وزنك", "checkin", day); }
  const out = { ok: true, points };
  if (metric === "weight") out.alerts = await parentAlerts(subject);
  return out;
}

export async function latest(userId, metric) {
  const r = await HealthLog.findOne({ user: userId, metric }).sort({ day: -1 }).lean();
  return r ? { value: r.value, day: r.day } : { value: null, day: null };
}
export async function weeklyAverages(userId, weeks = 8) {
  const since = addDays(today(), -7 * weeks);
  const rows = await HealthLog.find({ user: userId, metric: "weight", day: { $gte: since } }).sort({ day: 1 }).lean();
  const b = {};
  for (const r of rows) (b[weekStart(r.day)] ||= []).push(r.value);
  return Object.keys(b).sort().map((w) => ({ week: w, avg: +(b[w].reduce((a, c) => a + c, 0) / b[w].length).toFixed(1) }));
}
export async function trend(subject) {
  const wa = await weeklyAverages(subject._id, 8);
  const goal = await HealthGoal.findOne({ user: subject._id }).lean();
  const direction = goal?.direction || "keep";
  if (wa.length < 2) return { status: "not_enough", delta: null, weeks: wa.length, direction, weekly: wa };
  const recent = wa.slice(-3), prior = wa.slice(-6, -3).length ? wa.slice(-6, -3) : [wa[0]];
  const r = recent.reduce((a, c) => a + c.avg, 0) / recent.length, p = prior.reduce((a, c) => a + c.avg, 0) / prior.length;
  const delta = +(r - p).toFixed(1);
  let status;
  if (Math.abs(delta) < 0.3) status = "steady";
  else if ((delta < 0 && direction === "down") || (delta > 0 && direction === "up")) status = "improving";
  else if (direction === "keep") status = Math.abs(delta) < 1 ? "steady" : "attention";
  else status = "attention";
  return { status, delta, weeks: wa.length, direction, weekly: wa };
}

async function habitsLastWeek(userId) {
  const since = addDays(today(), -7);
  const sportTasks = await Task.find({ user: userId, domainKey: "sport" }).select("_id").lean();
  const sport = await Completion.countDocuments({ user: userId, status: "done", day: { $gte: since }, task: { $in: sportTasks.map((t) => t._id) } });
  const sleep = await HealthLog.find({ user: userId, metric: "sleep_h", day: { $gte: since } }).lean();
  const water = await HealthLog.countDocuments({ user: userId, metric: "water_cups", day: { $gte: since }, value: { $gte: 6 } });
  return { sport, sleepAvg: sleep.length ? +(sleep.reduce((a, c) => a + c.value, 0) / sleep.length).toFixed(1) : null, waterDays: water };
}

export async function weeklyMessage(subject, lang = "ar") {
  const t = await trend(subject), h = await habitsLastWeek(subject._id), name = subject.displayName;
  const good = [], fix = [];
  const ar = lang === "ar";
  if (h.sport >= 3) good.push(ar ? `الرياضة ${h.sport} مرات` : `sport ${h.sport}x`); else if (h.sport <= 1) fix.push(ar ? "نزيد يوم رياضة" : "add one sport day");
  if (h.sleepAvg && h.sleepAvg >= 9) good.push(ar ? "نوم كافٍ" : "good sleep"); else if (h.sleepAvg && h.sleepAvg < 8) fix.push(ar ? "ننام أبكر شوي" : "sleep a bit earlier");
  if (h.waterDays >= 5) good.push(ar ? "الماء كل يوم تقريباً" : "water most days"); else if (h.waterDays <= 2) fix.push(ar ? "نرجع للماء" : "back to water");
  const g = good.join("، "), f = fix.join("، ");
  const base = ar
    ? { improving: `ما شاء الله يا ${name}، ٣ أسابيع والاتجاه متحسّن.`, steady: `ثابت يا ${name}، وهذا عادي.`, attention: `هالأسبوع محتاج انتباه يا ${name}. مش غلط فيك.`, not_enough: `أهلاً ${name}. أحدين كمان ونشوف اتجاهك.` }[t.status]
    : { improving: `Mashallah ${name}, three weeks and the trend is improving.`, steady: `Steady, ${name}, and that's normal.`, attention: `This week needs attention, ${name}. Nothing wrong with you.`, not_enough: `Welcome ${name}. Two more Sundays and we'll see your trend.` }[t.status];
  const parts = [base];
  if (g && t.status === "improving") parts.push(ar ? `اللي فرق معك: ${g}.` : `What made the difference: ${g}.`);
  if (f) parts.push(ar ? `الأسبوع الجاي: ${f}.` : `Next week: ${f}.`);
  if (!f && ["steady", "attention"].includes(t.status)) parts.push(ar ? "خلينا نجرب نزيد يوم رياضة." : "Let's add one sport day.");
  return parts.join(" ");
}

export async function parentAlerts(subject) {
  if (!isChild(subject.role)) return [];
  const alerts = [], wa = await weeklyAverages(subject._id, 10), goal = await HealthGoal.findOne({ user: subject._id }).lean();
  if (wa.length >= 2 && wa[wa.length - 2].avg - wa[wa.length - 1].avg > 0.5) alerts.push(`${subject.displayName}: نزل أكثر من نصف كيلو في أسبوع. راجع الأكل والنوم، وإن تكرر استشر الطبيب.`);
  if (wa.length >= 8 && Math.abs(wa[wa.length - 1].avg - wa[wa.length - 8].avg) < 0.3 && ["down", "up"].includes(goal?.direction)) alerts.push(`${subject.displayName}: ثابت ٨ أسابيع رغم المتابعة. وقت مراجعة الطبيب لتعديل الخطة.`);
  const w = await latest(subject._id, "weight"), h = await latest(subject._id, "height_cm");
  const z = zoneForChild(bmi(w.value, h.value), subject.sex, ageOn(subject.birthDate));
  if (z?.zone === "under" && goal?.direction === "up") alerts.push(`${subject.displayName}: تحت النطاق للعمر. ركّز على ٣ وجبات منتظمة وبروتين ونوم ١٠ ساعات.`);
  if (alerts.length) {
    const parents = await User.find({ family: subject.family, role: { $in: ["owner", "admin"] } }).select("_id").lean();
    const since = new Date(Date.now() - 6 * 864e5);
    for (const p of parents) for (const a of alerts) {
      if (!(await Notification.exists({ user: p._id, body: a, createdAt: { $gte: since } }))) await Notification.create({ user: p._id, kind: "care", body: a });
    }
  }
  return alerts;
}

export async function view(viewer, subject, lang = "ar") {
  const goal = (await HealthGoal.findOne({ user: subject._id }).lean()) || {};
  const self = String(viewer._id) === String(subject._id);
  const showNumber = isParent(viewer.role) || (self && (!isChild(subject.role) || goal.visibility === "number"));
  const w = await latest(subject._id, "weight"), h = await latest(subject._id, "height_cm");
  const b = bmi(w.value, h.value);
  const zone = isChild(subject.role) ? zoneForChild(b, subject.sex, ageOn(subject.birthDate)) : zoneForAdult(b);
  const t = await trend(subject);
  const checkedIn = await HealthLog.exists({ user: subject._id, metric: "weight", day: { $gte: weekStart() } });
  const n = await HealthLog.countDocuments({ user: subject._id, metric: "weight" });
  const milestones = [];
  if (n >= 4) milestones.push("٤ فحوصات التزام"); if (n >= 12) milestones.push("٣ شهور متابعة");
  if (t.status === "improving" && t.weeks >= 4) milestones.push("أول شهر اتجاه متحسّن");
  if (zone?.zone === "healthy") milestones.push("داخل المنطقة الخضراء");
  const vals = t.weekly.map((x) => x.avg);
  let chart = { points: [], band: null };
  if (vals.length) {
    const lo = Math.min(...vals, goal.targetLow ?? vals[0]), hi = Math.max(...vals, goal.targetHigh ?? vals[0]), span = hi - lo || 1;
    chart = { points: t.weekly.map((x, i) => ({ x: i, y: +((x.avg - lo) / span).toFixed(3), v: showNumber ? x.avg : null, week: x.week })),
      band: goal.targetLow && goal.targetHigh ? { low: +((goal.targetLow - lo) / span).toFixed(3), high: +((goal.targetHigh - lo) / span).toFixed(3) } : null };
  }
  const out = { showNumber, trend: { status: t.status, delta: t.delta, weeks: t.weeks, direction: t.direction }, message: await weeklyMessage(subject, lang), milestones,
    checkedInThisWeek: !!checkedIn, goal, heightCm: h.value, chart, isSelf: self, viewerIsParent: isParent(viewer.role), isChild: isChild(subject.role),
    zoneLabel: zone ? (lang === "ar" ? zone.labelAr : zone.labelEn) : null, age: ageOn(subject.birthDate), sex: subject.sex };
  if (showNumber) Object.assign(out, { weight: w.value, weightDay: w.day, bmi: b, zone });
  if (isParent(viewer.role) && isChild(subject.role)) out.alerts = await parentAlerts(subject);
  return out;
}

export async function setGoal(actor, subject, fields) {
  if (isChild(subject.role) && !isParent(actor.role)) return false;
  if (String(actor._id) !== String(subject._id) && !isParent(actor.role)) return false;
  const set = {};
  for (const k of ["targetLow", "targetHigh", "weeklyRate", "direction", "source", "note", "visibility"]) if (fields[k] !== undefined && fields[k] !== "" && fields[k] !== null) set[k] = fields[k];
  await HealthGoal.updateOne({ user: subject._id }, { $set: set }, { upsert: true });
  return true;
}

export async function checkinMissing(familyId) {
  const ws = weekStart();
  const users = await User.find({ family: familyId, isActive: true, role: { $in: ["owner", "admin", "child", "teen_adult"] } }).lean();
  const out = [];
  for (const u of users) if (!(await HealthLog.exists({ user: u._id, metric: "weight", day: { $gte: ws } }))) out.push(u);
  return out;
}

export async function scaleLink(userId) {
  const row = await ScaleLink.findOne({ user: userId });
  if (row) return row.token;
  const token = crypto.randomBytes(18).toString("base64url");
  await ScaleLink.create({ user: userId, token });
  return token;
}
export async function scalePush(token, weightKg, { heightCm, day } = {}) {
  const link = await ScaleLink.findOne({ token });
  if (!link) return { ok: false, reason: "bad_token" };
  const subject = await User.findById(link.user).lean();
  const r = await logMeasure(null, subject, "weight", Number(weightKg), { day: day || today(), source: "scale" });
  if (r.ok && heightCm) await logMeasure(null, subject, "height_cm", Number(heightCm), { day: day || today(), source: "scale" });
  link.lastSync = new Date(); await link.save();
  return { ...r, userId: subject._id };
}
