// إشعارات الموبايل (Web Push): بدون رقم تلفون ولا تيليجرام ولا واتساب
import webpush from "web-push";
import { PushSub, AppKey } from "../models/index.js";

let ready = null;   // Promise<{ publicKey } | null>

/** مفاتيح VAPID: من متغيرات البيئة إن وُجدت، وإلا تُنشأ مرة وتُحفظ بقاعدة البيانات */
export function initPush() {
  if (ready) return ready;
  ready = (async () => {
    let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      const saved = await AppKey.findOne({ key: "vapid" }).lean();
      if (saved) ({ pub, priv } = JSON.parse(saved.value));
      else {
        const k = webpush.generateVAPIDKeys();
        pub = k.publicKey; priv = k.privateKey;
        try { await AppKey.create({ key: "vapid", value: JSON.stringify({ pub, priv }) }); }
        catch { ({ pub, priv } = JSON.parse((await AppKey.findOne({ key: "vapid" }).lean()).value)); } // سباق بين نسختين
      }
    }
    const contact = process.env.PUSH_CONTACT || process.env.APP_URL || "https://yuncrochet-jo.onrender.com";
    webpush.setVapidDetails(contact.startsWith("http") || contact.startsWith("mailto:") ? contact : `mailto:${contact}`, pub, priv);
    return { publicKey: pub };
  })().catch((e) => { console.error("push init failed:", e.message); ready = null; return null; });
  return ready;
}

// وين يفتح الإشعار لما تكبس عليه
const URLS = {
  approve: "/family/feed", reward: "/family/tasks?tab=rewards", task: "/family/tasks", points: "/family/tasks", badge: "/family/tasks",
  order: "/family/shop", prayer: "/family/prayer", care: "/family/health", security: "/family/settings", summary: "/family/tasks", test: "/family",
};
export const urlFor = (kind) => URLS[kind] || "/family";

export async function pushTo(userId, { title = "عيلتنا", body, kind = "info", url } = {}) {
  const keys = await initPush();
  if (!keys) return 0;
  const subs = await PushSub.find({ user: userId }).lean();
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title, body: String(body).slice(0, 300), url: url || urlFor(kind), tag: kind });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 6 * 3600, urgency: kind === "security" ? "high" : "normal" });
      sent++;
      await PushSub.updateOne({ _id: s._id }, { $set: { lastOk: new Date() } });
    } catch (e) {
      // الجهاز لغى الاشتراك أو انتهى: نشيله
      if (e.statusCode === 404 || e.statusCode === 410) await PushSub.deleteOne({ _id: s._id });
      else console.error("push failed:", e.statusCode || e.message);
    }
  }));
  return sent;
}
