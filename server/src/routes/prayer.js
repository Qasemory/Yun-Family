import { Router } from "express";
import { requireAuth, loadSubject, isParent } from "../middleware/auth.js";
import { logPrayer, confirmFajr, dayBoard, fajrStreak, familyFajrBoard, DHIKR, PRAYER_AR } from "../utils/worship.js";
import { today } from "../utils/dates.js";
import { award } from "../utils/points.js";
import { Completion } from "../models/index.js";

const r = Router();
r.use(requireAuth);

r.get("/", loadSubject(), async (req, res) => {
  const day = req.query.day || today();
  res.json({ day, board: await dayBoard(req.subject._id, day), streak: await fajrStreak(req.subject._id, day), family: await familyFajrBoard(req.user.family, day), dhikr: DHIKR, names: PRAYER_AR });
});
r.post("/log", async (req, res) => {
  const { prayer, status } = req.body || {};
  const out = await logPrayer(req.user, prayer, status);
  res.status(out.ok ? 200 : 400).json(out);
});
r.post("/confirm/:uid", async (req, res) => {
  if (!isParent(req.user.role)) return res.status(403).json({ error: "parents_only" });
  res.json(await confirmFajr(req.user, req.params.uid));
});
// الأذكار: +8 نقاط لكل مجموعة في اليوم
r.post("/dhikr/:slot", async (req, res) => {
  const slot = req.params.slot;
  if (!DHIKR[slot]) return res.status(400).json({ error: "bad_slot" });
  const day = today(), ref = `dhikr:${slot}`;
  const done = await Completion.exists({ user: req.user._id, day, source: ref });
  if (done) return res.json({ ok: true, already: true });
  // نسجّلها كإتمام بدون مهمة محددة: نستخدم points ledger فقط
  await award(req.user._id, 8, `أذكار ${slot === "morning" ? "الصباح" : slot === "evening" ? "المساء" : "النوم"}`, ref, day);
  res.json({ ok: true, points: 8 });
});

export default r;
