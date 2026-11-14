import { Router } from "express";
import { requireAuth, loadSubject, isParent, isChild } from "../middleware/auth.js";
import { HealthLog, ScaleLink, User } from "../models/index.js";
import * as W from "../utils/weight.js";
import { today } from "../utils/dates.js";
import { award } from "../utils/points.js";

const r = Router();
const SKILLS = { "Stage 4": ["pull-ups", "plank_s", "jump_rope", "swim_laps"], "Stage 6": ["plank_s", "swim_laps", "dance_parts", "run_min"] };
const FORBIDDEN_CHILD_SELF = new Set(["weight", "bmi", "calories", "growth", "height_cm", "waist_cm"]);

// نقطة الميزان العامة (قبل requireAuth)
r.post("/scale", async (req, res) => {
  const d = req.body || {};
  const token = d.token || req.query.token;
  const kg = Number(d.weight_kg ?? d.weight);
  if (!Number.isFinite(kg)) return res.status(400).json({ ok: false, reason: "weight_kg required" });
  const out = await W.scalePush(token || "", kg, { heightCm: d.height_cm ? Number(d.height_cm) : undefined, day: d.day });
  res.status(out.ok ? 200 : 403).json(out);
});

r.use(requireAuth);

r.get("/", loadSubject(), async (req, res) => {
  const s = req.subject, lang = req.user.uiLanguage === "en" ? "en" : "ar";
  const stage = (s.grade || "").startsWith("Stage 4") ? "Stage 4" : "Stage 6";
  const day = today();
  const get = async (m) => (await HealthLog.findOne({ user: s._id, day, metric: m }).lean())?.value ?? null;
  const skills = [];
  for (const k of SKILLS[stage]) { const best = await HealthLog.findOne({ user: s._id, metric: `skill:${k}` }).sort({ value: -1 }).lean(); skills.push({ skill: k, best: best?.value ?? null }); }
  const daily = { sleep: await get("sleep_h"), water: await get("water_cups"), mood: await get("mood"), skills, sleepTarget: stage === "Stage 4" ? 10 : 9, waterTarget: stage === "Stage 4" ? 7 : 8 };
  const weight = await W.view(req.user, s, lang);
  let scale = null;
  if (isParent(req.user.role) || String(req.user._id) === String(s._id)) scale = await ScaleLink.findOne({ user: s._id }).lean();
  res.json({ subject: { id: s._id, displayName: s.displayName, grade: s.grade, isChild: isChild(s.role) }, daily, weight, scale: scale ? { token: scale.token, lastSync: scale.lastSync } : null });
});

// سجلات يومية (نوم/ماء/مزاج/مهارة) — الولد لنفسه، أو الأهل له
r.post("/daily", loadSubject(), async (req, res) => {
  const { metric, value } = req.body || {};
  if (!metric || !Number.isFinite(Number(value))) return res.status(400).json({ error: "bad_input" });
  if (isChild(req.subject.role) && FORBIDDEN_CHILD_SELF.has(metric)) return res.status(403).json({ error: "use_weight_endpoint" });
  const day = today();
  let points = 0;
  if (metric.startsWith("skill:")) {
    const prev = await HealthLog.findOne({ user: req.subject._id, metric }).sort({ value: -1 }).lean();
    if (!prev || Number(value) > prev.value) { points = 5; await award(req.subject._id, 5, `مهارة جديدة: ${metric.slice(6)}`, "skill", day); }
  }
  await HealthLog.updateOne({ user: req.subject._id, day, metric }, { $set: { value: Number(value) } }, { upsert: true });
  res.json({ ok: true, points });
});

// فحص الأحد
r.post("/weight", loadSubject(), async (req, res) => {
  const { weight, height_cm, waist_cm, day } = req.body || {};
  const results = [];
  for (const [metric, v] of [["weight", weight], ["height_cm", height_cm], ["waist_cm", waist_cm]]) {
    if (v === undefined || v === "" || v === null) continue;
    const out = await W.logMeasure(req.user, req.subject, metric, Number(v), { day: day || today() });
    if (!out.ok) return res.status(out.reason === "child_needs_parent" ? 403 : 400).json(out);
    results.push({ metric, ...out });
  }
  res.json({ ok: true, results });
});
r.post("/goal", loadSubject(), async (req, res) => {
  const ok = await W.setGoal(req.user, req.subject, req.body || {});
  res.status(ok ? 200 : 403).json({ ok });
});
r.post("/profile", loadSubject(), async (req, res) => {
  if (!(isParent(req.user.role) || String(req.user._id) === String(req.subject._id))) return res.status(403).json({ error: "forbidden" });
  const set = {};
  if (["f", "m"].includes(req.body?.sex)) set.sex = req.body.sex;
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.body?.birthDate || "")) set.birthDate = req.body.birthDate;
  await User.updateOne({ _id: req.subject._id }, { $set: set });
  res.json({ ok: true });
});
r.post("/scale-link", loadSubject(), async (req, res) => {
  if (!(isParent(req.user.role) || String(req.user._id) === String(req.subject._id))) return res.status(403).json({ error: "forbidden" });
  res.json({ token: await W.scaleLink(req.subject._id) });
});

export default r;
