// برامجي (للأب والأم): الأعمال، المال، القرارات. كل شخص يشوف برامجه هو بس.
import { Router } from "express";
import { requireAuth, isParent } from "../middleware/auth.js";
import { WorkItem, Money, Decision } from "../models/index.js";
import { askJSON, aiReady, S } from "../utils/ai.js";
import { today } from "../utils/dates.js";

const r = Router();
r.use(requireAuth, (req, res, next) => (isParent(req.user.role) ? next() : res.status(403).json({ error: "parents_only" })));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, n = 200) => String(v ?? "").trim().slice(0, n);

const KINDS = {
  work: {
    model: WorkItem,
    clean: (b, partial) => {
      const o = {};
      if (!partial || b.title !== undefined) { o.title = str(b.title, 120); if (!o.title) return null; }
      if (b.due !== undefined) o.due = DAY.test(b.due) ? b.due : "";
      if (b.priority !== undefined) o.priority = ["high", "normal", "low"].includes(b.priority) ? b.priority : "normal";
      if (b.status !== undefined) o.status = ["todo", "doing", "done"].includes(b.status) ? b.status : "todo";
      if (b.note !== undefined) o.note = str(b.note, 500);
      return o;
    },
    sort: { status: 1, due: 1, createdAt: -1 },
  },
  money: {
    model: Money,
    clean: (b, partial) => {
      const o = {};
      if (!partial || b.amount !== undefined) { o.amount = Math.round((+b.amount || 0) * 100) / 100; if (!(o.amount > 0)) return null; }
      if (!partial || b.kind !== undefined) { o.kind = b.kind === "income" ? "income" : "expense"; }
      if (!partial || b.day !== undefined) o.day = DAY.test(b.day || "") ? b.day : today();
      if (b.category !== undefined) o.category = str(b.category, 40);
      if (b.note !== undefined) o.note = str(b.note, 200);
      return o;
    },
    sort: { day: -1, createdAt: -1 },
  },
  decisions: {
    model: Decision,
    clean: (b, partial) => {
      const o = {};
      if (!partial || b.title !== undefined) { o.title = str(b.title, 160); if (!o.title) return null; }
      for (const k of ["options", "choice", "reason", "outcome"]) if (b[k] !== undefined) o[k] = str(b[k], 1500);
      if (b.reviewOn !== undefined) o.reviewOn = DAY.test(b.reviewOn) ? b.reviewOn : "";
      if (b.status !== undefined) o.status = ["open", "decided", "reviewed"].includes(b.status) ? b.status : "open";
      return o;
    },
    sort: { createdAt: -1 },
  },
};
const kindOf = (req, res) => { const k = KINDS[req.params.kind]; if (!k) res.status(404).json({ error: "not_found" }); return k; };

r.get("/summary", async (req, res) => {
  const month = String(req.query.month || today().slice(0, 7)).slice(0, 7);
  const rows = await Money.find({ user: req.user._id, day: { $regex: `^${month}` } }).lean();
  const income = rows.filter((x) => x.kind === "income").reduce((a, x) => a + x.amount, 0);
  const expense = rows.filter((x) => x.kind === "expense").reduce((a, x) => a + x.amount, 0);
  const byCat = {};
  for (const x of rows.filter((x) => x.kind === "expense")) byCat[x.category || "—"] = (byCat[x.category || "—"] || 0) + x.amount;
  const work = await WorkItem.countDocuments({ user: req.user._id, status: { $ne: "done" } });
  const overdue = await WorkItem.countDocuments({ user: req.user._id, status: { $ne: "done" }, due: { $ne: "", $lt: today() } });
  const toReview = await Decision.countDocuments({ user: req.user._id, status: "decided", reviewOn: { $ne: "", $lte: today() } });
  res.json({ month, income, expense, net: income - expense, byCat: Object.entries(byCat).sort((a, b) => b[1] - a[1]), work, overdue, toReview, ai: aiReady() });
});

r.get("/:kind", async (req, res) => {
  const k = kindOf(req, res); if (!k) return;
  const q = { user: req.user._id };
  if (req.params.kind === "money" && req.query.month) q.day = { $regex: `^${String(req.query.month).slice(0, 7)}` };
  res.json(await k.model.find(q).sort(k.sort).limit(300).lean());
});
r.post("/:kind", async (req, res) => {
  const k = kindOf(req, res); if (!k) return;
  const d = k.clean(req.body || {}, false); if (!d) return res.status(400).json({ error: "bad_input" });
  res.json(await k.model.create({ ...d, user: req.user._id }));
});
r.patch("/:kind/:id", async (req, res) => {
  const k = kindOf(req, res); if (!k) return;
  const d = k.clean(req.body || {}, true); if (!d) return res.status(400).json({ error: "bad_input" });
  const doc = await k.model.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: d }, { new: true });
  if (!doc) return res.status(404).json({ error: "not_found" });
  res.json(doc);
});
r.delete("/:kind/:id", async (req, res) => {
  const k = kindOf(req, res); if (!k) return;
  await k.model.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
});

// «ساعدني أفكر»: Claude يرتب الإيجابيات والسلبيات ويسأل أسئلة مفيدة، والقرار إلك
r.post("/decisions/:id/think", async (req, res) => {
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  const d = await Decision.findOne({ _id: req.params.id, user: req.user._id });
  if (!d) return res.status(404).json({ error: "not_found" });
  const out = await askJSON({
    tag: "decide", effort: "medium",
    system: "You help a parent in Jordan think through a personal or work decision. Be practical and balanced; do not decide for them. Write in clear Arabic (Jordanian-friendly).",
    content: `Decision: ${d.title}\nOptions: ${d.options || "-"}\nCurrent leaning: ${d.choice || "-"}\nReasoning so far: ${d.reason || "-"}\n\nGive: pros and cons per option (short bullets), 3 questions worth asking before deciding, and one practical tip.`,
    schema: S.obj({ options: S.arr(S.obj({ option: S.str(), pros: S.arr(S.str()), cons: S.arr(S.str()) })), questions: S.arr(S.str()), tip: S.str() }),
    maxTokens: 3000,
  });
  if (!out) return res.status(502).json({ error: "ai_unavailable" });
  d.ai = out; await d.save();
  res.json(d);
});

export default r;
