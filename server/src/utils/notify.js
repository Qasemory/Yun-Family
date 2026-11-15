// إشعار داخل التطبيق + إشعار الموبايل + تيليجرام (إن رُبط الحساب ووُجد TELEGRAM_BOT_TOKEN)
import { Notification, User } from "../models/index.js";
import { pushTo } from "./push.js";

export const telegramReady = () => !!process.env.TELEGRAM_BOT_TOKEN;

export async function telegramSend(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
    return r.ok;
  } catch { return false; }
}

export async function notify(userOrId, kind, body) {
  const user = userOrId?._id ? userOrId : await User.findById(userOrId).select("telegramChatId").lean();
  if (!user) return;
  await Notification.create({ user: user._id, kind, body });
  await Promise.all([
    pushTo(user._id, { body, kind }).catch(() => 0),
    user.telegramChatId ? telegramSend(user.telegramChatId, body) : null,
  ]);
}

export async function notifyParents(familyId, kind, body) {
  const parents = await User.find({ family: familyId, role: { $in: ["owner", "admin"] }, isActive: true }).select("_id telegramChatId").lean();
  for (const p of parents) await notify(p, kind, body);
}
