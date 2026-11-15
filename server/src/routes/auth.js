import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User, Audit, Notification } from "../models/index.js";
import { signToken, requireAuth, visibleMembers, isParent, isChild } from "../middleware/auth.js";
import { notifyParents } from "../utils/points.js";
import { sendMail, appUrl, mailConfigured } from "../utils/mailer.js";

const r = Router();
const PIN_MAX = 3, PASS_MAX = 5, LOCK_MIN = 15;
const MIN_PASSWORD = 8;
const RESET_MIN = 30, VERIFY_HOURS = 24;
const publicUser = (u) => ({ id: u._id, displayName: u.displayName, role: u.role, grade: u.grade, color: u.color, uiLanguage: u.uiLanguage, family: u.family, sex: u.sex, birthDate: u.birthDate });

// ---------- أدوات ----------
// توحيد الاسم للمقارنة: بدون مسافات، حروف صغيرة، وتوحيد الهمزات والتاء المربوطة والألف المقصورة
const normName = (s) => String(s || "").trim().toLowerCase().replace(/[\sـ]+/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const newToken = () => { const raw = crypto.randomBytes(32).toString("hex"); return { raw, hash: sha256(raw) }; };
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// حد بسيط للطلبات بالذاكرة (لكل IP): يكفي لخدمة واحدة على Render
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return list.length <= max;
}
const ip = (req) => req.ip || req.headers["x-forwarded-for"] || "?";

async function setPassword(user, plain) {
  user.passwordHash = await bcrypt.hash(String(plain), 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;      // يُخرج كل الأجهزة الأخرى
  user.failedAttempts = 0; user.lockedUntil = undefined;
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined;
}
async function mailPasswordChanged(user, byName) {
  if (!user.email || !user.emailVerified) return;
  await sendMail({
    to: user.email, subject: "تغيّرت كلمة السر · عيلتنا", title: "تغيّرت كلمة السر",
    body: byName ? `${byName} غيّر كلمة سر حسابك (${user.displayName}). إذا ما كنت تعرف، تواصل معه فوراً.` : `تغيّرت كلمة سر حسابك (${user.displayName}) وطلعت كل الأجهزة. إذا ما كنت إنت، استعمل «نسيت كلمة السر؟» فوراً.`,
  });
}
async function sendVerifyEmail(user) {
  const { raw, hash } = newToken();
  user.emailTokenHash = hash; user.emailTokenExpires = new Date(Date.now() + VERIFY_HOURS * 3600e3);
  await user.save();
  return sendMail({
    to: user.email, subject: "أكّد إيميلك · عيلتنا", title: `أهلاً ${user.displayName}`,
    body: "اضغط الزر لتأكيد إيميلك. بعد التأكيد بتقدر تستعيد كلمة السر إذا نسيتها. الرابط صالح ٢٤ ساعة.",
    button: { label: "تأكيد الإيميل", url: `${appUrl()}/family/verify-email?token=${raw}` },
  });
}

// ---------- الدخول ----------
// الدخول بالاسم المكتوب (لا توجد قائمة أسماء عامة حتى لا تظهر أسماء العيلة لأي زائر)
r.post("/login", async (req, res) => {
  if (!rateLimit(`login:${ip(req)}`, 30, 15 * 60e3)) return res.status(429).json({ error: "too_many" });
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
  const hash = isChild(user.role) ? user.pinHash : user.passwordHash;
  const ok = hash && (await bcrypt.compare(String(raw), hash));
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

// ---------- الأمان: حالة الحساب ----------
r.get("/security", requireAuth, async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const filter = req.user.role === "owner" ? { family: req.user.family } : { actor: req.user._id };
  const recent = await Audit.find({ ...filter, action: { $in: ["login", "password_fail", "pin_fail", "password_changed", "password_reset", "password_reset_by_owner"] } })
    .sort({ createdAt: -1 }).limit(15).populate("actor", "displayName").lean();
  res.json({
    email: req.user.email || "", emailVerified: !!req.user.emailVerified, mailReady: mailConfigured(),
    recent: recent.map((a) => ({ id: a._id, action: a.action, who: a.actor?.displayName || "", at: a.createdAt, detail: a.detail || "" })),
  });
});

// ---------- تغيير كلمة السر (من داخل الحساب) ----------
r.post("/change-password", requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  if (isChild(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(current || ""), user.passwordHash || ""))) return res.status(400).json({ error: "bad_current" });
  if (!next || String(next).length < MIN_PASSWORD) return res.status(400).json({ error: "weak" });
  await setPassword(user, next); await user.save();
  await Audit.create({ family: user.family, actor: user._id, action: "password_changed" });
  await mailPasswordChanged(user);
  // توكن جديد لهذا الجهاز فيضل داخل، وباقي الأجهزة تطلع
  res.json({ ok: true, token: signToken(user) });
});

// الأب يعيد ضبط كلمة سر الأم
r.post("/reset-password-for", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "owner_only" });
  const { userId, next } = req.body || {};
  const target = await User.findOne({ _id: userId, family: req.user.family, role: "admin", isActive: true });
  if (!target) return res.status(404).json({ error: "not_found" });
  if (!next || String(next).length < MIN_PASSWORD) return res.status(400).json({ error: "weak" });
  await setPassword(target, next); await target.save();
  await Notification.create({ user: target._id, kind: "security", body: `${req.user.displayName} أعاد ضبط كلمة سرك.` });
  await Audit.create({ family: req.user.family, actor: req.user._id, action: "password_reset_by_owner", severity: "alert", detail: target.displayName });
  await mailPasswordChanged(target, req.user.displayName);
  res.json({ ok: true });
});

// الأهل يعيدون ضبط PIN الولد
r.post("/reset-pin", requireAuth, async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const { userId, pin } = req.body || {};
  const child = await User.findOne({ _id: userId, family: req.user.family });
  if (!child || !isChild(child.role) || !/^\d{4,6}$/.test(String(pin || ""))) return res.status(400).json({ error: "bad_input" });
  child.pinHash = await bcrypt.hash(String(pin), 10); child.failedAttempts = 0; child.lockedUntil = undefined;
  child.tokenVersion = (child.tokenVersion || 0) + 1;
  await child.save();
  await Notification.create({ user: child._id, kind: "security", body: `${req.user.displayName} غيّر رمز دخولك.` });
  await Audit.create({ family: req.user.family, actor: req.user._id, action: "reset_pin", detail: child.displayName });
  res.json({ ok: true });
});

// ---------- الإيميل ----------
// إضافة أو تغيير الإيميل (يحتاج كلمة السر الحالية)
r.post("/email", requireAuth, async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "bad_email" });
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(req.body?.password || ""), user.passwordHash || ""))) return res.status(400).json({ error: "bad_current" });
  const taken = await User.exists({ email, _id: { $ne: user._id } });
  if (taken) return res.status(409).json({ error: "email_taken" });
  if (user.email !== email) { user.email = email; user.emailVerified = false; }
  if (user.emailVerified) { await user.save(); return res.json({ ok: true, verified: true }); }
  const sent = await sendVerifyEmail(user);
  await Audit.create({ family: user.family, actor: user._id, action: "email_set" });
  res.json({ ok: true, verified: false, sent });
});

r.post("/email/resend", requireAuth, async (req, res) => {
  if (!rateLimit(`verify:${req.user._id}`, 3, 15 * 60e3)) return res.status(429).json({ error: "too_many" });
  const user = await User.findById(req.user._id);
  if (!user.email || user.emailVerified) return res.status(400).json({ error: "nothing_to_verify" });
  res.json({ ok: true, sent: await sendVerifyEmail(user) });
});

r.post("/email/verify", async (req, res) => {
  const token = String(req.body?.token || "");
  if (!token) return res.status(400).json({ error: "bad_token" });
  const user = await User.findOne({ emailTokenHash: sha256(token), emailTokenExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: "bad_token" });
  user.emailVerified = true; user.emailTokenHash = undefined; user.emailTokenExpires = undefined;
  await user.save();
  await Audit.create({ family: user.family, actor: user._id, action: "email_verified" });
  res.json({ ok: true });
});

// ---------- نسيت كلمة السر ----------
// نفس الرد دائماً حتى لا يُعرف أي الإيميلات مسجّلة
r.post("/forgot", async (req, res) => {
  const okReply = () => res.json({ ok: true });
  if (!rateLimit(`forgot:${ip(req)}`, 5, 15 * 60e3)) return res.status(429).json({ error: "too_many" });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return okReply();
  const user = await User.findOne({ email, emailVerified: true, isActive: true, role: { $in: ["owner", "admin"] } });
  if (!user) return okReply();
  // طلب واحد بالدقيقة لكل حساب
  if (user.resetRequestedAt && Date.now() - user.resetRequestedAt.getTime() < 60e3) return okReply();
  const { raw, hash } = newToken();
  user.resetTokenHash = hash; user.resetTokenExpires = new Date(Date.now() + RESET_MIN * 60e3); user.resetRequestedAt = new Date();
  await user.save();
  await sendMail({
    to: user.email, subject: "استعادة كلمة السر · عيلتنا", title: "طلب تغيير كلمة السر",
    body: `وصلنا طلب لتغيير كلمة سر حساب ${user.displayName}. الرابط بيشتغل مرة وحدة وصالح ${RESET_MIN} دقيقة. إذا ما طلبت إنت، تجاهل الرسالة وكلمة سرك ما بتتغيّر.`,
    button: { label: "اختر كلمة سر جديدة", url: `${appUrl()}/family/reset?token=${raw}` },
  });
  await Audit.create({ family: user.family, actor: user._id, action: "reset_requested" });
  okReply();
});

r.post("/reset", async (req, res) => {
  if (!rateLimit(`reset:${ip(req)}`, 10, 15 * 60e3)) return res.status(429).json({ error: "too_many" });
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: "bad_token" });
  if (!password || String(password).length < MIN_PASSWORD) return res.status(400).json({ error: "weak" });
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() }, isActive: true });
  if (!user) return res.status(400).json({ error: "bad_token" });
  await setPassword(user, password); await user.save();
  await Audit.create({ family: user.family, actor: user._id, action: "password_reset", severity: "alert" });
  await mailPasswordChanged(user);
  res.json({ ok: true });
});

r.post("/language", requireAuth, async (req, res) => {
  const lang = ["ar", "en", "mixed"].includes(req.body?.lang) ? req.body.lang : "ar";
  await User.updateOne({ _id: req.user._id }, { $set: { uiLanguage: lang } });
  res.json({ ok: true, lang });
});

export default r;
