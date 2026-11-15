import { Router } from "express";
import { requireAuth, loadSubject, isParent, isChild, canAccess } from "../middleware/auth.js";
import { Task, Completion, PointsLedger, User, Audit } from "../models/index.js";
import { dayPlan, complete, confirm, balance, todayPoints, funUnlocked, streakDays, award } from "../utils/points.js";
import { checkBadges } from "../utils/journey.js";
import { saveImage } from "../utils/images.js";
import { notify } from "../utils/notify.js";
import { today, ageOn } from "../utils/dates.js";
import { askJSON, aiReady, S } from "../utils/ai.js";

const r = Router();
r.use(requireAuth);

// خطة اليوم + النقاط + الترفيه لشخص (?u=)
r.get("/plan", loadSubject(), async (req, res) => {
  const day = req.query.day || today();
  const plan = await dayPlan(req.subject._id, day);
  res.json({
    day, plan, balance: await balance(req.subject._id), today: await todayPoints(req.subject._id, day),
    fun: await funUnlocked(req.subject, day), streaks: { prayer: await streakDays(req.subject._id, "prayer", day), study: await streakDays(req.subject._id, "study", day) },
  });
});

r.post("/:taskId/done", async (req, res) => {
  let proofUrl = req.body?.proofUrl;
  if (req.body?.proofImage) {
    proofUrl = await saveImage(req.body.proofImage, { family: req.user.family, owner: req.user._id, purpose: "proof" });
    if (!proofUrl) return res.status(400).json({ error: "bad_image" });
  }
  const out = await complete(req.user, req.params.taskId, { proofUrl });
  if (out.ok && out.status === "done" && !out.already) out.badges = await checkBadges(req.user);
  res.status(out.ok ? 200 : 400).json(out);
});

// تحقق إن التأكيد/الرفض لولد من نفس العيلة ومسموح للأهل يعدّلوا عليه
async function ownCompletion(req, res) {
  if (!isParent(req.user.role)) { res.status(403).json({ error: "parents_only" }); return null; }
  const c = await Completion.findById(req.params.id).populate("task");
  const kid = c && (await User.findById(c.user).lean());
  if (!c || !kid || !canAccess(req.user, kid).canEdit) { res.status(404).json({ error: "not_found" }); return null; }
  return { c, kid };
}
r.post("/completion/:id/confirm", async (req, res) => {
  const own = await ownCompletion(req, res); if (!own) return;
  const out = await confirm(req.user, req.params.id);
  if (out.ok) { out.badges = await checkBadges(own.kid); await notify(own.kid, "task", `✅ ${req.user.displayName} أكّد «${own.c.task?.title}» (+${out.points}).`); }
  res.json(out);
});
r.post("/completion/:id/reject", async (req, res) => {
  const own = await ownCompletion(req, res); if (!own) return;
  const { c, kid } = own;
  if (c.status !== "pending_confirm") return res.status(400).json({ error: "bad_input" });
  const note = String(req.body?.note || "").slice(0, 200);
  // نحذف الإنجاز حتى يقدر الولد يعيد المهمة اليوم
  await Completion.deleteOne({ _id: c._id });
  await notify(kid, "task", `↩️ «${c.task?.title}» محتاجة تكمّلها${note ? `: ${note}` : "."}`);
  res.json({ ok: true });
});

// الأهل: المهام المنتظرة للتأكيد (أولاد العيلة فقط)
r.get("/pending", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const kids = await User.find({ family: req.user.family, role: { $in: ["child", "teen_adult"] } }).select("_id").lean();
  const list = await Completion.find({ status: "pending_confirm", user: { $in: kids.map((k) => k._id) } }).populate("task").populate("user", "displayName color").sort({ createdAt: -1 }).lean();
  res.json(list);
});

// ---------- إدارة مهام الولد (الأهل) ----------
const DOMAIN_KEYS = ["prayer", "study", "quran", "dhikr", "sport", "language", "hobby", "health", "home"];
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** ينظّف بيانات المهمة: الحقول المسموحة فقط وبقيم معقولة */
function cleanTask(b = {}, partial = false) {
  const out = {};
  const has = (k) => b[k] !== undefined;
  if (has("title") || !partial) { const t = String(b.title || "").trim().slice(0, 80); if (!t) return { error: "bad_input" }; out.title = t; }
  if (has("domainKey") || !partial) out.domainKey = DOMAIN_KEYS.includes(b.domainKey) ? b.domainKey : "home";
  if (has("preferredTime") || !partial) out.preferredTime = HM.test(b.preferredTime || "") ? b.preferredTime : "";
  if (has("durationMin") || !partial) out.durationMin = Math.min(240, Math.max(0, Math.round(+b.durationMin || 0)));
  if (has("points") || !partial) out.points = Math.min(100, Math.max(1, Math.round(+b.points || 5)));
  for (const k of ["mandatory", "needsProof", "needsParentConfirm", "active"]) if (has(k) || (!partial && k !== "active")) out[k] = !!b[k];
  if (has("days") || !partial) {
    const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    out.days = days.length ? days : [0, 1, 2, 3, 4, 5, 6];
  }
  return { data: out };
}
async function ownTask(req, res) {
  if (!isParent(req.user.role)) { res.status(403).json({ error: "parents_only" }); return null; }
  const t = await Task.findById(req.params.id);
  const kid = t && (await User.findById(t.user).lean());
  if (!t || !kid || !canAccess(req.user, kid).canEdit) { res.status(404).json({ error: "not_found" }); return null; }
  return t;
}
r.get("/manage", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role) && String(req.subject._id) !== String(req.user._id)) return res.status(403).json({ error: "forbidden" });
  res.json(await Task.find({ user: req.subject._id }).sort({ active: -1, preferredTime: 1 }).lean());
});
r.post("/manage", loadSubject(), async (req, res) => {
  if (!req.canEdit || !isParent(req.user.role)) return res.status(403).json({ error: "forbidden" });
  const { data, error } = cleanTask(req.body);
  if (error) return res.status(400).json({ error });
  res.json(await Task.create({ ...data, user: req.subject._id, active: true }));
});
r.patch("/manage/:id", async (req, res) => {
  const t = await ownTask(req, res); if (!t) return;
  const { data, error } = cleanTask(req.body, true);
  if (error) return res.status(400).json({ error });
  Object.assign(t, data); await t.save();
  res.json(t);
});
r.delete("/manage/:id", async (req, res) => {
  const t = await ownTask(req, res); if (!t) return;
  await Task.deleteOne({ _id: t._id });       // الإنجازات والنقاط القديمة بتضل بالسجل
  res.json({ ok: true });
});

// نقاط إضافية أو خصم مع السبب (الأهل)
r.post("/points", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role) || !req.canEdit || !isChild(req.subject.role)) return res.status(403).json({ error: "forbidden" });
  const delta = Math.round(+req.body?.delta || 0);
  const reason = String(req.body?.reason || "").trim().slice(0, 120);
  if (!delta || Math.abs(delta) > 500 || !reason) return res.status(400).json({ error: "bad_input" });
  await award(req.subject._id, delta, `${delta > 0 ? "مكافأة" : "خصم"}: ${reason}`, `manual:${req.user._id}`);
  await Audit.create({ family: req.user.family, actor: req.user._id, action: "points_manual", detail: `${req.subject.displayName} ${delta > 0 ? "+" : ""}${delta} (${reason})` });
  await notify(req.subject, "points", `${delta > 0 ? "🎉" : "📝"} ${req.user.displayName}: ${delta > 0 ? "+" : ""}${delta} نقطة · ${reason}`);
  const out = { ok: true, balance: await balance(req.subject._id) };
  if (delta > 0) out.badges = await checkBadges(req.subject);
  res.json(out);
});

// اقتراح مهام مناسبة لعمر الولد (الأهل يختاروا شو يضيفوا)
const DOMAINS = ["study", "quran", "dhikr", "sport", "language", "hobby", "health", "home"];
r.post("/suggest", loadSubject(), async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  const s = req.subject;
  const existing = await Task.find({ user: s._id, active: true }).select("title domainKey preferredTime").lean();
  const age = s.birthDate ? ageOn(s.birthDate) : null;
  const out = await askJSON({
    tag: "tasks",
    system: "You help Muslim parents in Jordan plan small, realistic daily tasks for their children in a family app. Tasks are short, positive and doable; never punishments.",
    content: `Child: ${s.displayName}${age ? `, age ${age}` : ""}, school stage: ${s.grade || "unknown"}.
Current tasks: ${existing.map((t) => `${t.title} (${t.domainKey}${t.preferredTime ? ` ${t.preferredTime}` : ""})`).join("; ") || "none"}.
Parent's wish (may be empty): ${String(req.body?.wish || "").slice(0, 300) || "-"}

Suggest 5 new daily tasks that fill gaps and do not repeat current ones. title: short Arabic title (2-5 words). why: one short Arabic sentence for the parent. domainKey: one of ${DOMAINS.join(", ")}. preferredTime: HH:MM in 24h. durationMin: 5-45. points: 3-15 (harder or longer = more).`,
    schema: S.obj({ tasks: S.arr(S.obj({ title: S.str(), why: S.str(), domainKey: S.enum(DOMAINS), preferredTime: S.str(), durationMin: S.int(), points: S.int() })) }),
    maxTokens: 3000,
  });
  if (!out) return res.status(502).json({ error: "ai_unavailable" });
  res.json(out.tasks.slice(0, 6).map((t) => ({ ...t, preferredTime: /^\d{2}:\d{2}$/.test(t.preferredTime) ? t.preferredTime : "", durationMin: Math.min(60, Math.max(5, t.durationMin)), points: Math.min(15, Math.max(3, t.points)) })));
});

r.get("/ledger", loadSubject(), async (req, res) => res.json(await PointsLedger.find({ user: req.subject._id }).sort({ createdAt: -1 }).limit(100).lean()));

export default r;
