// صديقي: رفيق محادثة آمن للأولاد (Claude). المحادثة مكشوفة للأهل، وأي شي مقلق بيوصلهم.
import { Router } from "express";
import { requireAuth, loadSubject, isChild, isParent } from "../middleware/auth.js";
import { FriendMsg } from "../models/index.js";
import { askJSON, aiReady, S } from "../utils/ai.js";
import { notifyParents } from "../utils/notify.js";
import { today, ageOn } from "../utils/dates.js";

const r = Router();
r.use(requireAuth);
const DAILY = 30;

r.get("/", loadSubject(), async (req, res) => {
  const s = req.subject;
  if (!isChild(s.role)) return res.status(400).json({ error: "kids_only" });
  if (String(s._id) !== String(req.user._id) && !isParent(req.user.role)) return res.status(403).json({ error: "forbidden" });
  const msgs = await FriendMsg.find({ user: s._id }).sort({ createdAt: -1 }).limit(60).lean();
  const used = await FriendMsg.countDocuments({ user: s._id, from: "kid", day: today() });
  if (!isParent(req.user.role)) for (const m of msgs) delete m.concern;
  res.json({ ai: aiReady(), left: Math.max(0, DAILY - used), messages: msgs.reverse() });
});

const SYSTEM = (kid, age) => `You are "صديقي" (My Friend), a warm, playful and safe companion for ${kid.displayName}, a ${kid.sex === "f" ? "girl" : kid.sex === "m" ? "boy" : "child"}${age ? ` aged ${age}` : ""} in a Muslim family in Jordan, inside a private family app. The parents can read every message.
Rules:
- Reply in the language the child uses (Jordanian Arabic or simple English). Address the child with the correct gender. Keep replies short (1-4 sentences), kind and age-appropriate.
- Encourage curiosity, learning, good manners, prayer and kindness to family. You can tell short stories, riddles, fun facts and help think through homework (guide, do not just give answers).
- Never ask for or encourage sharing personal details (address, school, phone, photos). Never pretend to be a human. Never keep secrets from parents; if the child asks you to keep a secret, gently say parents care and can help.
- No romance, violence, scary content, brands to buy, or anything a careful parent would not want.
- If the child seems sad, scared, bullied, hurt, or mentions danger, respond with comfort, suggest talking to Mum or Dad, and set concern to "high" with a short Arabic reason for the parents. Mild worries = "low". Otherwise "none".`;

r.post("/", async (req, res) => {
  if (!isChild(req.user.role)) return res.status(403).json({ error: "kids_only" });
  if (!aiReady()) return res.status(503).json({ error: "ai_off" });
  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "empty" });
  const day = today();
  if ((await FriendMsg.countDocuments({ user: req.user._id, from: "kid", day })) >= DAILY) return res.status(429).json({ error: "friend_limit" });
  const history = (await FriendMsg.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(12).lean()).reverse();
  const kidMsg = await FriendMsg.create({ user: req.user._id, from: "kid", text, day });
  const out = await askJSON({
    tag: "friend",
    system: SYSTEM(req.user, req.user.birthDate ? ageOn(req.user.birthDate) : null),
    content: `Conversation so far:\n${history.map((m) => `${m.from === "kid" ? "Child" : "Friend"}: ${m.text}`).join("\n") || "(new conversation)"}\n\nChild: ${text}\n\nWrite the friend's next reply.`,
    schema: S.obj({ reply: S.str(), concern: S.enum(["none", "low", "high"]), reason: S.str() }),
    maxTokens: 1200,
  });
  if (!out) { await FriendMsg.deleteOne({ _id: kidMsg._id }); return res.status(502).json({ error: "ai_unavailable" }); }
  if (out.concern !== "none") { kidMsg.concern = out.concern; await kidMsg.save(); }
  if (out.concern === "high") await notifyParents(req.user.family, "care", `💛 صديقي: ${req.user.displayName} ممكن يحتاج حكي منكم. ${out.reason || ""} (المحادثة بصفحة صديقي)`);
  const reply = await FriendMsg.create({ user: req.user._id, from: "friend", text: out.reply, day });
  res.json({ message: { _id: reply._id, from: "friend", text: reply.text, createdAt: reply.createdAt } });
});

export default r;
