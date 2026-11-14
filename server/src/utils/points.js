import { Completion, PointsLedger, Task, Notification, User } from "../models/index.js";
import { today, weekday, isWeekend, addDays } from "./dates.js";
import { getSettings } from "./settings.js";

export async function dayPlan(userId, day = today()) {
  const w = weekday(day);
  const tasks = await Task.find({ user: userId, active: true, days: w }).sort({ preferredTime: 1 }).lean();
  const comps = await Completion.find({ user: userId, day }).lean();
  const byTask = Object.fromEntries(comps.map((c) => [String(c.task), c]));
  return tasks.map((t) => ({ ...t, status: byTask[String(t._id)]?.status || "todo", completionId: byTask[String(t._id)]?._id }));
}

export async function balance(userId) {
  const r = await PointsLedger.aggregate([{ $match: { user: userId } }, { $group: { _id: null, s: { $sum: "$delta" } } }]);
  return r[0]?.s || 0;
}
export async function todayPoints(userId, day = today()) {
  const r = await PointsLedger.aggregate([{ $match: { user: userId, day } }, { $group: { _id: null, s: { $sum: "$delta" } } }]);
  return r[0]?.s || 0;
}
export async function award(userId, delta, reason, ref = "", day = today()) {
  if (!delta) return;
  await PointsLedger.create({ user: userId, delta, reason, ref, day });
}

export async function complete(user, taskId, { proofUrl, source = "web" } = {}, day = today()) {
  const task = await Task.findOne({ _id: taskId, user: user._id, active: true });
  if (!task) return { ok: false, reason: "not_found" };
  const existing = await Completion.findOne({ task: task._id, day });
  if (existing) return { ok: true, already: true, status: existing.status, points: 0 };
  if (task.needsProof && !proofUrl) return { ok: false, reason: "needs_proof" };
  const status = task.needsParentConfirm ? "pending_confirm" : "done";
  const c = await Completion.create({ task: task._id, user: user._id, day, status, proofUrl, source });
  let points = 0;
  if (status === "done") { points = task.points; await award(user._id, points, task.title, `task:${task._id}`, day); }
  return { ok: true, status, points, completionId: c._id };
}

export async function confirm(parent, completionId) {
  const c = await Completion.findById(completionId).populate("task");
  if (!c || c.status !== "pending_confirm") return { ok: false };
  c.status = "done"; c.confirmedBy = parent._id; await c.save();
  await award(c.user, c.task.points, c.task.title, `task:${c.task._id}`, c.day);
  return { ok: true, points: c.task.points };
}

export async function funUnlocked(user, day = today()) {
  const plan = await dayPlan(user._id, day);
  const mandatory = plan.filter((t) => t.mandatory);
  const pending = mandatory.filter((t) => t.status !== "done");
  const s = await getSettings(user.family);
  const stage = (user.grade || "").startsWith("Stage 4") ? "stage4" : "stage6";
  const minutes = Number(s[`fun_minutes_${isWeekend(day) ? "weekend" : "weekday"}_${stage}`] || 45);
  return { unlocked: pending.length === 0 && mandatory.length > 0, pending: pending.map((t) => t.title), minutes };
}

export async function streakDays(userId, domainKey, day = today()) {
  let n = 0, d = day;
  for (let i = 0; i < 60; i++) {
    const tasks = await Task.find({ user: userId, domainKey }).select("_id").lean();
    const done = await Completion.exists({ user: userId, day: d, status: "done", task: { $in: tasks.map((t) => t._id) } });
    if (!done) break;
    n++; d = addDays(d, -1);
  }
  return n;
}

export async function notifyParents(familyId, kind, body) {
  const parents = await User.find({ family: familyId, role: { $in: ["owner", "admin"] } }).select("_id").lean();
  await Notification.insertMany(parents.map((p) => ({ user: p._id, kind, body })));
}
