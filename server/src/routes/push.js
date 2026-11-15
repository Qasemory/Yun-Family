// إشعارات الموبايل: الجهاز يسجّل اشتراكه، والسيرفر يبعتله
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { PushSub } from "../models/index.js";
import { initPush, pushTo } from "../utils/push.js";

const r = Router();

r.get("/key", async (req, res) => {
  const k = await initPush();
  if (!k) return res.status(503).json({ error: "push_off" });
  res.json({ publicKey: k.publicKey });
});

r.use(requireAuth);

r.get("/status", async (req, res) => {
  const devices = await PushSub.find({ user: req.user._id }).select("device createdAt lastOk endpoint").sort({ createdAt: -1 }).lean();
  res.json({ devices: devices.map((d) => ({ id: d._id, device: d.device || "", createdAt: d.createdAt, lastOk: d.lastOk, endpoint: d.endpoint })) });
});

r.post("/subscribe", async (req, res) => {
  const sub = req.body?.subscription || {};
  const endpoint = String(sub.endpoint || "");
  if (!/^https:\/\/.{10,}/.test(endpoint) || endpoint.length > 1000 || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: "bad_input" });
  // نفس الجهاز لو كان مسجّل لشخص ثاني (تبديل الحساب على تابلت مشترك) ينتقل للحالي
  await PushSub.findOneAndUpdate(
    { endpoint },
    { $set: { user: req.user._id, keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) }, device: String(req.body?.device || "").slice(0, 80) } },
    { upsert: true, new: true },
  );
  // حد معقول للأجهزة لكل شخص: نخلي أحدث ١٠
  const extra = await PushSub.find({ user: req.user._id }).sort({ updatedAt: -1 }).skip(10).select("_id").lean();
  if (extra.length) await PushSub.deleteMany({ _id: { $in: extra.map((x) => x._id) } });
  res.json({ ok: true });
});

r.post("/unsubscribe", async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (endpoint) await PushSub.deleteOne({ endpoint, user: req.user._id });
  else if (req.body?.id) await PushSub.deleteOne({ _id: req.body.id, user: req.user._id });
  res.json({ ok: true });
});

r.post("/test", async (req, res) => {
  const sent = await pushTo(req.user._id, { title: "عيلتنا", body: `أهلاً ${req.user.displayName}! الإشعارات شغّالة على هالجهاز 🎉`, kind: "test" });
  res.json({ sent });
});

export default r;
