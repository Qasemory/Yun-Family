// الرحلة: قطار اليوم + نجوم الأسبوع + الشارات + متجر المكافآت + قطار العيلة
import { Router } from "express";
import { requireAuth, loadSubject, isParent, isChild, canAccess } from "../middleware/auth.js";
import { Badge, Reward, Redemption, User } from "../models/index.js";
import { dayPlan, funUnlocked, balance, award } from "../utils/points.js";
import { journeyStreak, weekView, checkBadges, BADGES, familyTrain } from "../utils/journey.js";
import { setSetting } from "../utils/settings.js";
import { notify, notifyParents } from "../utils/notify.js";
import { today } from "../utils/dates.js";

const r = Router();
r.use(requireAuth);
const parentsOnly = (req, res, next) => (isParent(req.user.role) ? next() : res.status(403).json({ error: "parents_only" }));

// الرحلة لشخص (?u=)
r.get("/", loadSubject(), async (req, res) => {
  const s = req.subject;
  const day = today();
  const fresh = isChild(s.role) ? await checkBadges(s, day) : [];
  const [plan, fun, week, st, badges, bal, train] = await Promise.all([
    dayPlan(s._id, day), funUnlocked(s, day), weekView(s._id, day), journeyStreak(s._id, day),
    Badge.find({ user: s._id }).lean(), balance(s._id), familyTrain(s.family, day),
  ]);
  const got = Object.fromEntries(badges.map((b) => [b.key, b.day]));
  res.json({
    day, plan, fun, week, streak: st.streak, graceLeft: st.graceLeft, balance: bal, freshBadges: fresh,
    badges: BADGES.map((b) => ({ ...b, earned: got[b.key] || null })), family: train,
  });
});

// ---------- المكافآت ----------
const STARTER = [
  { icon: "🎮", title: "٣٠ دقيقة ألعاب زيادة", cost: 100 },
  { icon: "🍕", title: "أختار أكلة الجمعة", cost: 200 },
  { icon: "🎬", title: "فيلم سهرة العيلة من اختياري", cost: 250 },
  { icon: "🛝", title: "طلعة للحديقة أو الملاهي", cost: 500 },
  { icon: "💵", title: "دينار مصروف زيادة", cost: 150 },
  { icon: "🌙", title: "سهرة نص ساعة زيادة (ويكند)", cost: 120 },
];
async function ensureStarter(family) {
  if (await Reward.exists({ family })) return;
  await Reward.insertMany(STARTER.map((x) => ({ ...x, family })));
}

r.get("/rewards", async (req, res) => {
  await ensureStarter(req.user.family);
  const rewards = await Reward.find({ family: req.user.family, ...(isParent(req.user.role) ? {} : { active: true }) }).sort({ cost: 1 }).lean();
  const q = isParent(req.user.role) ? { family: req.user.family } : { user: req.user._id };
  const redemptions = await Redemption.find(q).populate("user", "displayName color").sort({ createdAt: -1 }).limit(40).lean();
  res.json({ rewards, redemptions, balance: isParent(req.user.role) ? null : await balance(req.user._id) });
});

const cleanReward = (b = {}) => {
  const title = String(b.title || "").trim().slice(0, 60);
  const cost = Math.round(+b.cost || 0);
  if (!title || cost < 1 || cost > 10000) return null;
  return { title, cost, icon: String(b.icon || "🎁").slice(0, 4), ...(b.active !== undefined ? { active: !!b.active } : {}) };
};
r.post("/rewards", parentsOnly, async (req, res) => {
  const d = cleanReward(req.body); if (!d) return res.status(400).json({ error: "bad_input" });
  res.json(await Reward.create({ ...d, family: req.user.family }));
});
r.patch("/rewards/:id", parentsOnly, async (req, res) => {
  const cur = await Reward.findOne({ _id: req.params.id, family: req.user.family });
  if (!cur) return res.status(404).json({ error: "not_found" });
  const d = cleanReward({ ...cur.toObject(), ...req.body }); if (!d) return res.status(400).json({ error: "bad_input" });
  Object.assign(cur, d); await cur.save(); res.json(cur);
});
r.delete("/rewards/:id", parentsOnly, async (req, res) => {
  await Reward.deleteOne({ _id: req.params.id, family: req.user.family });
  res.json({ ok: true });
});

// الولد يطلب مكافأة: النقاط ما بتنخصم إلا بعد موافقة الأهل
r.post("/rewards/:id/redeem", async (req, res) => {
  if (!isChild(req.user.role)) return res.status(403).json({ error: "kids_only" });
  const rw = await Reward.findOne({ _id: req.params.id, family: req.user.family, active: true }).lean();
  if (!rw) return res.status(404).json({ error: "not_found" });
  const pending = await Redemption.find({ user: req.user._id, status: "pending" }).lean();
  if (pending.length >= 3) return res.status(400).json({ error: "too_many_pending" });
  const reserved = pending.reduce((a, p) => a + (p.cost || 0), 0);
  if ((await balance(req.user._id)) - reserved < rw.cost) return res.status(400).json({ error: "not_enough" });
  const red = await Redemption.create({ family: req.user.family, user: req.user._id, reward: rw._id, title: rw.title, icon: rw.icon, cost: rw.cost });
  await notifyParents(req.user.family, "reward", `${rw.icon} ${req.user.displayName} طلب مكافأة: «${rw.title}» (${rw.cost} نقطة). وافقوا من صفحة المهام.`);
  res.json(red);
});

async function ownRedemption(req, res) {
  const red = await Redemption.findOne({ _id: req.params.id, family: req.user.family, status: "pending" });
  const kid = red && (await User.findById(red.user).lean());
  if (!red || !kid || !canAccess(req.user, kid).canEdit) { res.status(404).json({ error: "not_found" }); return null; }
  return { red, kid };
}
r.post("/redemptions/:id/approve", parentsOnly, async (req, res) => {
  const own = await ownRedemption(req, res); if (!own) return;
  const { red, kid } = own;
  if ((await balance(kid._id)) < red.cost) return res.status(400).json({ error: "not_enough" });
  red.status = "approved"; red.decidedBy = req.user._id; await red.save();
  await award(kid._id, -red.cost, `مكافأة: ${red.title}`, `reward:${red._id}`);
  await notify(kid, "reward", `${red.icon} وافقوا على «${red.title}»! استمتع 🎉`);
  await checkBadges(kid);
  res.json({ ok: true });
});
r.post("/redemptions/:id/reject", parentsOnly, async (req, res) => {
  const own = await ownRedemption(req, res); if (!own) return;
  const { red, kid } = own;
  red.status = "rejected"; red.decidedBy = req.user._id; await red.save();
  const note = String(req.body?.note || "").slice(0, 150);
  await notify(kid, "reward", `«${red.title}» مش هلأ${note ? `: ${note}` : ""}. نقاطك محفوظة.`);
  res.json({ ok: true });
});

// ---------- قطار العيلة ----------
r.post("/family-goal", parentsOnly, async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 80);
  const target = Math.round(+req.body?.target || 0);
  if (title && (target < 50 || target > 100000)) return res.status(400).json({ error: "bad_input" });
  await setSetting(req.user.family, "family_goal_title", title);
  await setSetting(req.user.family, "family_goal_target", title ? target : 0);
  res.json(await familyTrain(req.user.family));
});

export default r;
