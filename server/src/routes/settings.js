import { Router } from "express";
import { requireAuth, requireParent } from "../middleware/auth.js";
import { getSettings, setSetting } from "../utils/settings.js";
import { Audit } from "../models/index.js";

const r = Router();
r.use(requireAuth, requireParent);
r.get("/", async (req, res) => res.json(await getSettings(req.user.family)));
r.post("/", async (req, res) => {
  const allowed = ["points_per_dinar", "monthly_reward_cap_jod", "savings_ratio", "fun_minutes_weekday_stage4", "fun_minutes_weekday_stage6", "fun_minutes_weekend_stage4", "fun_minutes_weekend_stage6"];
  for (const k of allowed) if (req.body?.[k] !== undefined) await setSetting(req.user.family, k, req.body[k]);
  res.json(await getSettings(req.user.family));
});
r.get("/audit", async (req, res) => {
  if (req.user.role !== "owner") return res.status(403).json({ error: "owner_only" });
  res.json(await Audit.find({ family: req.user.family }).populate("actor", "displayName").sort({ createdAt: -1 }).limit(100).lean());
});
export default r;
