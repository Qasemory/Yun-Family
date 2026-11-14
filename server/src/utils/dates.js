// كل التواريخ بتوقيت عمّان كنص YYYY-MM-DD
const TZ = process.env.TZ || "Asia/Amman";

export function today(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function nowHM(d = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
export function weekday(dayStr = today()) {          // 0 = الأحد
  return new Date(dayStr + "T12:00:00Z").getUTCDay();
}
export function addDays(dayStr, n) {
  const d = new Date(dayStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(dayStr = today()) {        // الأسبوع يبدأ الأحد
  return addDays(dayStr, -weekday(dayStr));
}
export function isWeekend(dayStr = today()) {        // الجمعة والسبت
  const w = weekday(dayStr); return w === 5 || w === 6;
}
export function ageOn(birthDate, dayStr = today()) {
  if (!birthDate) return null;
  const b = new Date(birthDate), t = new Date(dayStr);
  let a = t.getUTCFullYear() - b.getUTCFullYear();
  if (t.getUTCMonth() < b.getUTCMonth() || (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
