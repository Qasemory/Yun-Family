import { Router } from "express";
import { requireAuth, isParent, isChild } from "../middleware/auth.js";
import { Post, User, Notification } from "../models/index.js";
import { award } from "../utils/points.js";
import { askJSON, S } from "../utils/ai.js";
import { saveImage } from "../utils/images.js";

const r = Router();
r.use(requireAuth);
const TOUCHES = { proud: "فخور فيك", mashallah: "ما شاء الله", bravo: "أحسنت", heart: "قلب" };
const SENSITIVE = ["مدرسة", "school", "عنوان", "address", "شارع", "street", "رقم الهاتف"];

r.get("/", async (req, res) => {
  const posts = await Post.find({ family: req.user.family, $or: [{ status: "published" }, { author: req.user._id }, ...(isParent(req.user.role) ? [{ status: "pending" }] : [])] })
    .populate("author", "displayName color").populate("touches.user", "displayName").sort({ createdAt: -1 }).limit(60).lean();
  if (!isParent(req.user.role)) for (const p of posts) delete p.note;
  res.json({ posts, touches: TOUCHES });
});
r.post("/", async (req, res) => {
  const { text, kind, image } = req.body || {};
  let imageUrl;
  if (image) { imageUrl = await saveImage(image, { family: req.user.family, owner: req.user._id, purpose: "post" }); if (!imageUrl) return res.status(400).json({ error: "bad_image" }); }
  if (!text && !imageUrl) return res.status(400).json({ error: "empty" });
  let note = SENSITIVE.some((w) => (text || "").toLowerCase().includes(w)) ? "فيه كلمة حساسة (مدرسة/عنوان/هاتف)." : "";
  // منشورات الولاد: فحص مبدئي بالذكاء الاصطناعي (معلومات شخصية، تنمّر، كلام مؤذٍ أو حزين يحتاج انتباه)
  if (!note && text && isChild(req.user.role)) {
    const m = await askJSON({
      tag: "moderate",
      system: "You check posts written by children in a private family app before they are shown to the rest of the family. Parents always have the final say.",
      content: `Post by a ${req.user.sex === "f" ? "girl" : req.user.sex === "m" ? "boy" : "child"}:
<post>${String(text).slice(0, 2000)}</post>

flag = true only if the post shares personal location/contact details (address, school name, phone), contains bullying, insults or inappropriate words, or shows sadness, fear or a worry that a parent should gently notice. Normal happy, silly or everyday posts are not flagged. reason: if flagged, one short Arabic sentence for the parent explaining why (kind, no drama); otherwise empty.`,
      schema: S.obj({ flag: S.bool(), reason: S.str() }), maxTokens: 800,
    });
    if (m?.flag) note = m.reason || "يحتاج نظرة من الأهل.";
  }
  // الصغير (Stage 4) ينشر بموافقة؛ وأي منشور فيه ملاحظة يروح للموافقة
  if (!note && imageUrl && isChild(req.user.role)) note = "فيه صورة من الولد.";
  const needsApproval = (isChild(req.user.role) && (req.user.grade || "").startsWith("Stage 4")) || !!note;
  const post = await Post.create({ family: req.user.family, author: req.user._id, text, imageUrl, kind: kind || "post", status: needsApproval ? "pending" : "published", note: note || undefined });
  if (needsApproval) {
    const parents = await User.find({ family: req.user.family, role: { $in: ["owner", "admin"] } }).select("_id").lean();
    await Notification.insertMany(parents.map((p) => ({ user: p._id, kind: "approve", body: `${req.user.displayName} نشر في عيلتنا وينتظر الموافقة.${note ? ` ملاحظة: ${note}` : ""}` })));
  }
  const out = post.toObject(); if (!isParent(req.user.role)) delete out.note;
  res.json(out);
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
