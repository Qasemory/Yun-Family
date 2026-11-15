import "dotenv/config";
import express from "express";
import Layer from "express/lib/router/layer.js";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import prayerRoutes from "./routes/prayer.js";
import healthRoutes from "./routes/health.js";
import { storePublic, shopAdmin } from "./routes/shop.js";
import familyRoutes from "./routes/family.js";
import studyRoutes from "./routes/study.js";
import settingsRoutes from "./routes/settings.js";
import journeyRoutes from "./routes/journey.js";
import friendRoutes from "./routes/friend.js";
import programRoutes from "./routes/programs.js";
import telegramRoutes, { setupTelegram } from "./routes/telegram.js";
import { serveImage } from "./utils/images.js";
import pushRoutes from "./routes/push.js";
import { initPush } from "./utils/push.js";
import { startScheduler } from "./scheduler.js";
import { Family } from "./models/index.js";
import { seed } from "./seed.js";
import { requireAuth, isParent } from "./middleware/auth.js";
import { aiUsage } from "./utils/ai.js";

// أي خطأ داخل دالة async يروح لمعالج الأخطاء بدل ما يطفي السيرفر (Express 4 ما بيعملها لحاله)
const handle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  if (this.handle.length > 3) return handle.call(this, req, res, next);
  try { const out = this.handle(req, res, next); if (out && typeof out.catch === "function") out.catch(next); } catch (e) { next(e); }
};
process.on("unhandledRejection", (e) => console.error("unhandled:", e?.message || e));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" })); // صور الكتب والمنتجات (مصغّرة من المتصفح)
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : true }));

app.get("/healthz", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/prayer", prayerRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/store", storePublic);
app.use("/api/shop", shopAdmin);
app.use("/api/family", familyRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/journey", journeyRoutes);
app.use("/api/friend", friendRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/push", pushRoutes);
app.get("/api/img/:key", (req, res, next) => serveImage(req, res).catch(next));
app.get("/api/ai/status", requireAuth, (req, res) => res.json(isParent(req.user.role) ? aiUsage() : { ready: aiUsage().ready }));
app.post("/api/scale", (req, res, next) => { req.url = "/scale"; healthRoutes(req, res, next); }); // اختصار لربط الميزان

// في الإنتاج: نخدم واجهة React المبنية من نفس الخدمة
const dist = path.join(__dirname, "../../client/dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => err && res.status(404).send("Client not built. Run: npm run build"));
});
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, req, res, next) => {
  if (err?.name === "CastError") return res.status(404).json({ error: "not_found" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "too_large" });
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  if (!(await Family.exists({}))) { console.log("قاعدة فارغة: تهيئة أولية…"); await seed(); }
  startScheduler();
  setupTelegram();
  initPush();
  app.listen(PORT, () => console.log(`API على المنفذ ${PORT}`));
}).catch((e) => { console.error("فشل الاتصال بـ MongoDB:", e.message); process.exit(1); });
