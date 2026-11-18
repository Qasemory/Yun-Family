// بوت تيليجرام: ربط الحساب برمز مؤقت، استلام الإشعارات، وأوامر بسيطة (/today /points /done)
import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth, isChild } from "../middleware/auth.js";
import { User, Audit } from "../models/index.js";
import { telegramSend, telegramReady } from "../utils/notify.js";
import { dayPlan, balance, complete } from "../utils/points.js";
import { checkBadges } from "../utils/journey.js";

const r = Router();
const hookSecret = () => crypto.createHash("sha256").update(`tg:${process.env.TELEGRAM_BOT_TOKEN || ""}`).digest("hex").slice(0, 32);
let botName = null;
async function getBotName() {
  if (botName || !telegramReady()) return botName;
  try { const j = await (await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)).json(); botName = j?.result?.username || null; } catch { /* لاحقاً */ }
  return botName;
}

/** يسجّل عنوان الـ webhook عند تشغيل السيرفر (Render يعطي RENDER_EXTERNAL_URL تلقائياً) */
export async function setupTelegram() {
  const base = (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (!telegramReady() || !base) return;
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: `${base}/api/telegram/hook/${hookSecret()}`, allowed_updates: ["message"] }) });
    console.log("telegram: webhook set");
  } catch (e) { console.log("telegram: webhook failed", e.message); }
}

r.get("/status", requireAuth, async (req, res) => {
  const u = await User.findById(req.user._id).select("telegramChatId").lean();
  res.json({ ready: telegramReady(), linked: !!u.telegramChatId, bot: await getBotName() });
});
r.post("/link", requireAuth, async (req, res) => {
  if (!telegramReady()) return res.status(503).json({ error: "telegram_off" });
  const code = crypto.randomBytes(5).toString("hex");
  await User.updateOne({ _id: req.user._id }, { $set: { telegramLinkCode: code, telegramLinkExpires: new Date(Date.now() + 15 * 60e3) } });
  const bot = await getBotName();
  res.json({ code, bot, url: bot ? `https://t.me/${bot}?start=${code}` : null });
});
r.post("/unlink", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { telegramChatId: 1, telegramLinkCode: 1, telegramLinkExpires: 1 } });
  res.json({ ok: true });
});

const HELP = "الأوامر:\n/today مهام اليوم\n/points نقاطي\n/done رقم: خلصت مهمة (للأولاد)\n/stop إيقاف الإشعارات";
r.post("/hook/:secret", async (req, res) => {
  if (req.params.secret !== hookSecret()) return res.status(404).end();
  res.json({ ok: true }); // نرد فوراً ونكمل
  const msg = req.body?.message;
  const chatId = msg?.chat?.id && String(msg.chat.id);
  const text = String(msg?.text || "").trim();
  if (!chatId || !text) return;
  try {
    const start = /^\/start\s+([a-f0-9]{10})$/.exec(text);
    if (start) {
      const u = await User.findOne({ telegramLinkCode: start[1], telegramLinkExpires: { $gt: new Date() } });
      if (!u) return telegramSend(chatId, "الرمز غلط أو انتهى. اطلب رمز جديد من الإعدادات بالتطبيق.");
      await User.updateMany({ telegramChatId: chatId }, { $unset: { telegramChatId: 1 } });
      u.telegramChatId = chatId; u.telegramLinkCode = undefined; u.telegramLinkExpires = undefined; await u.save();
      await Audit.create({ family: u.family, actor: u._id, action: "telegram_linked" });
      return telegramSend(chatId, `أهلاً ${u.displayName}! انربط حسابك، ورح توصلك إشعارات عيلتنا هون.\n\n${HELP}`);
    }
    const user = await User.findOne({ telegramChatId: chatId, isActive: true });
    if (!user) return telegramSend(chatId, "هاد الحساب مش مربوط. من التطبيق: الإعدادات ← تيليجرام ← اربط.");
    if (text === "/stop") { user.telegramChatId = undefined; await user.save(); return telegramSend(chatId, "وقّفنا الإشعارات. بتقدر تربط من جديد من الإعدادات."); }
    if (text === "/points") return telegramSend(chatId, `رصيدك: ${await balance(user._id)} نقطة.`);
    if (text === "/today") {
      const plan = await dayPlan(user._id);
      if (!plan.length) return telegramSend(chatId, "ما في مهام اليوم.");
      return telegramSend(chatId, plan.map((t, i) => `${i + 1}. ${t.status === "done" ? "✅" : t.status === "pending_confirm" ? "🟡" : "⬜"} ${t.preferredTime || ""} ${t.title} (+${t.points})`).join("\n") + (isChild(user.role) ? "\n\nلما تخلص: /done رقم" : ""));
    }
    const done = /^\/done\s+(\d{1,2})$/.exec(text);
    if (done && isChild(user.role)) {
      const plan = await dayPlan(user._id);
      const t = plan[+done[1] - 1];
      if (!t) return telegramSend(chatId, "ما في مهمة بهالرقم. اكتب /today");
      if (t.kind === "lesson") return telegramSend(chatId, "هاد درس، افتحه من التطبيق (دراستي) وخلّص الامتحان 📚");
      if (t.needsProof) return telegramSend(chatId, "هاي المهمة بدها صورة إثبات، سجّلها من التطبيق.");
      const out = await complete(user, t._id, { source: "telegram" });
      if (out.ok && out.status === "done" && !out.already) await checkBadges(user);
      return telegramSend(chatId, out.already ? "مسجّلة من قبل 👍" : out.status === "pending_confirm" ? "انبعتت للأهل للتأكيد 🟡" : `برافو! +${out.points} 🎉`);
    }
    return telegramSend(chatId, HELP);
  } catch (e) { console.error("telegram hook", e.message); }
});

export default r;
