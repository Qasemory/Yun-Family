import { Router } from "express";
import { requireAuth, isParent, isChild } from "../middleware/auth.js";
import { Post, User, Notification } from "../models/index.js";
import { award } from "../utils/points.js";

const r = Router();
r.use(requireAuth);
const TOUCHES = { proud: "فخور فيك", mashallah: "ما شاء الله", bravo: "أحسنت", heart: "قلب" };
const SENSITIVE = ["مدرسة", "school", "عنوان", "address", "شارع", "street", "رقم الهاتف"];

r.get("/", async (req, res) => {
  const posts = await Post.find({ family: req.user.family, $or: [{ status: "published" }, { author: req.user._id }, ...(isParent(req.user.role) ? [{ status: "pending" }] : [])] })
    .populate("author", "displayName color").populate("touches.user", "displayName").sort({ createdAt: -1 }).limit(60).lean();
  res.json({ posts, touches: TOUCHES });
});
r.post("/", async (req, res) => {
  const { text, imageUrl, kind } = req.body || {};
  if (!text && !imageUrl) return res.status(400).json({ error: "empty" });
  const safe = !SENSITIVE.some((w) => (text || "").toLowerCase().includes(w));
  // الصغير (Stage 4) ينشر بموافقة؛ الكلمات الحساسة تذهب للموافقة دائماً
  const needsApproval = (isChild(req.user.role) && (req.user.grade || "").startsWith("Stage 4")) || !safe;
  const post = await Post.create({ family: req.user.family, author: req.user._id, text, imageUrl, kind: kind || "post", status: needsApproval ? "pending" : "published" });
  if (needsApproval) {
    const parents = await User.find({ family: req.user.family, role: { $in: ["owner", "admin"] } }).select("_id").lean();
    await Notification.insertMany(parents.map((p) => ({ user: p._id, kind: "approve", body: `${req.user.displayName} نشر في عيلتنا وينتظر الموافقة.` })));
  }
  res.json(post);
});
r.post("/:id/approve", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const p = await Post.findOneAndUpdate({ _id: req.params.id, family: req.user.family }, { $set: { status: "published" } }, { new: true });
  res.json(p);
});
r.post("/:id/touch", async (req, res) => {
  const { kind, text } = req.body || {};
  if (!TOUCHES[kind] && !text) return res.status(400).json({ error: "bad_touch" });
  const p = await Post.findOne({ _id: req.params.id, family: req.user.family });
  if (!p) return res.status(404).json({ error: "not_found" });
  p.touches.push({ user: req.user._id, kind, text }); await p.save();
  if (String(p.author) !== String(req.user._id) && isChild((await User.findById(p.author).lean())?.role)) await award(p.author, 2, `لمسة: ${TOUCHES[kind] || "تعليق"}`, "touch");
  res.json({ ok: true });
});

export default r;
