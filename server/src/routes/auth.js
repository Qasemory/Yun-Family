import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, Audit, Notification } from "../models/index.js";
import { signToken, requireAuth, visibleMembers, isParent, isChild } from "../middleware/auth.js";
import { notifyParents } from "../utils/points.js";

const r = Router();
const PIN_MAX = 3, PASS_MAX = 5, LOCK_MIN = 15;
const publicUser = (u) => ({ id: u._id, displayName: u.displayName, role: u.role, grade: u.grade, color: u.color, uiLanguage: u.uiLanguage, family: u.family, sex: u.sex, birthDate: u.birthDate });

// توحيد الاسم للمقارنة: بدون مسافات، حروف صغيرة، وتوحيد الهمزات والتاء المربوطة والألف المقصورة
const normName = (s) => String(s || "").trim().toLowerCase().replace(/[\sـ]+/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

// الدخول بالاسم المكتوب (لا توجد قائمة أسماء عامة حتى لا تظهر أسماء العيلة لأي زائر)
r.post("/login", async (req, res) => {
  const { name, secret: s, password, pin } = req.body || {};
  const target = normName(name);
  const raw = s ?? password ?? pin;
  if (!target || !raw) return res.status(400).json({ error: "bad_login" });
  const candidates = (await User.find({ isActive: true, role: { $in: ["owner", "admin", "child", "teen_adult"] } })).filter((u) => normName(u.displayName) === target);
  if (!candidates.length) return res.status(400).json({ error: "bad_login" });
  // لو تشابه اسمان نختار من تطابق كلمة سره، وإلا الأول
  let user = candidates[0];
  if (candidates.length > 1) {
    for (const c of candidates) {
      const h = isChild(c.role) ? c.pinHash : c.passwordHash;
      if (h && (await bcrypt.compare(String(raw), h))) { user = c; break; }
    }
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return res.status(423).json({ error: "locked", until: user.lockedUntil });
  const secret = raw;
  const hash = isChild(user.role) ? user.pinHash : user.passwordHash;
  const ok = secret && hash && (await bcrypt.compare(String(secret), hash));
  if (!ok) {
    user.failedAttempts += 1;
    const max = isChild(user.role) ? PIN_MAX : PASS_MAX;
    if (user.failedAttempts >= max) {
      user.lockedUntil = new Date(Date.now() + LOCK_MIN * 60000); user.failedAttempts = 0;
      await Audit.create({ family: user.family, actor: user._id, action: isChild(user.role) ? "pin_fail" : "password_fail", severity: "alert", detail: `قفل ${LOCK_MIN} دقيقة` });
      if (isChild(user.role)) await notifyParents(user.family, "security", `جهاز ${user.displayName}: ٣ محاولات PIN خاطئة، قُفل ١٥ دقيقة.`);
    }
    await user.save();
    return res.status(400).json({ error: "bad_login" });
  }
  user.failedAttempts = 0; user.lockedUntil = undefined; await user.save();
  await Audit.create({ family: user.family, actor: user._id, action: "login" });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get("/me", requireAuth, async (req, res) => {
  const members = await visibleMembers(req.user);
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ user: publicUser(req.user), members: members.map(publicUser), unread });
});

r.get("/notifications", requireAuth, async (req, res) => {
  const list = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json(list);
});

r.post("/change-password", requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  if (isChild(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(current || ""), user.passwordHash))) return res.status(400).json({ error: "bad_current" });
  if (!next || String(next).length < 8) return res.status(400).json({ error: "weak" });
  user.passwordHash = await bcrypt.hash(String(next), 10); await user.save();
  res.json({ ok: true });
});

// الأهل يعيدون ضبط PIN الولد
r.post("/reset-pin", requireAuth, async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { userId, pin } = req.body || {};
  const child = await User.findOne({ _id: userId, family: req.user.family });
  if (!child || !isChild(child.role) || !/^\d{4,6}$/.test(String(pin || ""))) return res.status(400).json({ error: "bad_input" });
  child.pinHash = await bcrypt.hash(String(pin), 10); child.failedAttempts = 0; child.lockedUntil = undefined; await child.save();
  await Notification.create({ user: child._id, kind: "security", body: `${req.user.displayName} غيّر رمز دخولك.` });
  await Audit.create({ family: req.user.family, actor: req.user._id, action: "reset_pin", detail: child.displayName });
  res.json({ ok: true });
});

r.post("/language", requireAuth, async (req, res) => {
  const lang = ["ar", "en", "mixed"].includes(req.body?.lang) ? req.body.lang : "ar";
  await User.updateOne({ _id: req.user._id }, { $set: { uiLanguage: lang } });
  res.json({ ok: true, lang });
});

export default r;
