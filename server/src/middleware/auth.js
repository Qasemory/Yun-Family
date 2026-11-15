import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export const PARENT_ROLES = new Set(["owner", "admin"]);
export const CHILD_ROLES = new Set(["child", "teen_adult"]);
export const isParent = (role) => PARENT_ROLES.has(role);
export const isChild = (role) => CHILD_ROLES.has(role);

export function signToken(user) {
  return jwt.sign({ uid: String(user._id), role: user.role, fam: String(user.family), tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

export async function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.uid).lean();
    if (!user || !user.isActive) return res.status(401).json({ error: "unauthorized" });
    // جلسة قديمة من قبل تغيير كلمة السر
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ error: "session_expired" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireParent(req, res, next) {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  next();
}

/** هرم الصلاحيات: الأب يرى الكل، الأم ترى الأولاد والبيت ونفسها (لا الأب)، الولد يرى نفسه فقط. */
export function canAccess(viewer, subject, scope = "all") {
  if (String(viewer.family) !== String(subject.family)) return { allowed: false, canEdit: false };
  if (String(viewer._id) === String(subject._id)) return { allowed: true, canEdit: true };
  if (viewer.role === "owner") return { allowed: true, canEdit: true };
  if (viewer.role === "admin") {
    if (subject.role === "owner") return { allowed: false, canEdit: false };
    return { allowed: true, canEdit: isChild(subject.role) };
  }
  if (scope === "social") return { allowed: true, canEdit: false };   // عيلتنا مشتركة
  return { allowed: false, canEdit: false };
}

/** يحمّل الشخص المطلوب (?u=... أو params.uid) ويتحقق من الصلاحية. */
export function loadSubject(scope = "all") {
  return async (req, res, next) => {
    const uid = req.params.uid || req.query.u || req.body?.userId || String(req.user._id);
    const subject = String(uid) === String(req.user._id) ? req.user : await User.findById(uid).lean();
    if (!subject) return res.status(404).json({ error: "not_found" });
    const d = canAccess(req.user, subject, scope);
    if (!d.allowed) return res.status(403).json({ error: "forbidden" });
    req.subject = subject; req.canEdit = d.canEdit;
    next();
  };
}

export async function visibleMembers(viewer) {
  const all = await User.find({ family: viewer.family, isActive: true }).sort({ createdAt: 1 }).lean();
  return all.filter((u) => canAccess(viewer, u).allowed);
}
