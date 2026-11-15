// المهام الدورية داخل نفس الخدمة (Render خدمة واحدة): تذكير الصلاة، فحص الأحد، ملخص المساء
import cron from "node-cron";
import { User, Family } from "./models/index.js";
import { notify } from "./utils/notify.js";
import { checkinMissing, CHECKIN_POINTS, weeklyMessage } from "./utils/weight.js";
import { dayPlan, todayPoints } from "./utils/points.js";
import { PRAYER_AR } from "./utils/worship.js";

const TZ = process.env.TZ || "Asia/Amman";
const PRAYER_TIMES = { fajr: "04:52", dhuhr: "11:25", asr: "14:20", maghrib: "16:50", isha: "18:10" }; // تقريبية لعمّان؛ تُربط بمصدر مواقيت لاحقاً

export function startScheduler() {
  // تذكير الصلاة لحظة الأذان
  for (const [p, t] of Object.entries(PRAYER_TIMES)) {
    const [h, m] = t.split(":").map(Number);
    cron.schedule(`${m} ${h} * * *`, async () => {
      const users = await User.find({ isActive: true, role: { $in: ["owner", "admin", "child", "teen_adult"] } }).lean();
      for (const u of users) await notify(u, "prayer", `حان وقت صلاة ${PRAYER_AR[p]}. لما تصلي سجّلها من صفحة صلاتي.`);
    }, { timezone: TZ });
  }
  // فحص الأحد ١٩:٠٠ والاثنين ٠٨:٠٠
  const checkin = async () => {
    for (const fam of await Family.find().lean()) {
      const parents = await User.find({ family: fam._id, role: { $in: ["owner", "admin"] } }).lean();
      for (const u of await checkinMissing(fam._id)) {
        if (["child", "teen_adult"].includes(u.role)) {
          for (const par of parents) await notify(par, "care", `فحص الأحد: قيسوا وزن ${u.displayName} وسجّلوه من صفحته (+${CHECKIN_POINTS} له).`);
          await notify(u, "care", `فحص الأحد: ${u.displayName}، بعد شوي ماما أو بابا بيقيسوا وزنك. +${CHECKIN_POINTS} نقاط لما يتسجّل.`);
        } else {
          await notify(u, "care", `فحص الأحد: سجّل وزنك من صفحة الصحة (+${CHECKIN_POINTS}). ${await weeklyMessage(u)}`);
        }
      }
    }
  };
  cron.schedule("0 19 * * 0", checkin, { timezone: TZ });
  cron.schedule("0 8 * * 1", checkin, { timezone: TZ });
  // ملخص المساء للأولاد ٢٠:٣٠
  cron.schedule("30 20 * * *", async () => {
    const kids = await User.find({ isActive: true, role: { $in: ["child", "teen_adult"] } }).lean();
    for (const k of kids) {
      const plan = await dayPlan(k._id); const done = plan.filter((p) => p.status === "done").length;
      await notify(k, "summary", `يومك: ${done} من ${plan.length}، نقاط اليوم ${await todayPoints(k._id)}. تصبح على خير.`);
    }
  }, { timezone: TZ });
  console.log("scheduler: running (" + TZ + ")");
}
