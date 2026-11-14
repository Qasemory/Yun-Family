import { Router } from "express";
import { requireAuth, loadSubject, isParent } from "../middleware/auth.js";
import { Task, Completion, PointsLedger } from "../models/index.js";
import { dayPlan, complete, confirm, balance, todayPoints, funUnlocked, streakDays } from "../utils/points.js";
import { today } from "../utils/dates.js";

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
  const out = await complete(req.user, req.params.taskId, { proofUrl: req.body?.proofUrl });
  res.status(out.ok ? 200 : 400).json(out);
});

r.post("/completion/:id/confirm", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  res.json(await confirm(req.user, req.params.id));
});

// الأهل: المهام المنتظرة للتأكيد
r.get("/pending", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const list = await Completion.find({ status: "pending_confirm" }).populate("task").populate("user", "displayName color family").sort({ createdAt: -1 }).lean();
  res.json(list.filter((c) => String(c.user?.family) === String(req.user.family)));
});

// إدارة مهام الولد (الأهل)
r.get("/manage", loadSubject(), async (req, res) => res.json(await Task.find({ user: req.subject._id }).sort({ preferredTime: 1 }).lean()));
r.post("/manage", loadSubject(), async (req, res) => {
  if (!req.canEdit || !isParent(req.user.role)) return res.status(403).json({ error: "forbidden" });
  const { title, domainKey, preferredTime, durationMin, points, mandatory, needsProof, needsParentConfirm, days } = req.body || {};
  const t = await Task.create({ user: req.subject._id, title, domainKey: domainKey || "home", preferredTime, durationMin: +durationMin || 0, points: +points || 5, mandatory: !!mandatory, needsProof: !!needsProof, needsParentConfirm: !!needsParentConfirm, days: days?.length ? days : undefined });
  res.json(t);
});
r.patch("/manage/:id", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  const t = await Task.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  res.json(t);
});

r.get("/ledger", loadSubject(), async (req, res) => res.json(await PointsLedger.find({ user: req.subject._id }).sort({ createdAt: -1 }).limit(100).lean()));

export default r;
