import "dotenv/config";
import express from "express";
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
import { startScheduler } from "./scheduler.js";
import { Family } from "./models/index.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
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
app.post("/api/scale", (req, res, next) => { req.url = "/scale"; healthRoutes(req, res, next); }); // اختصار لربط الميزان

// في الإنتاج: نخدم واجهة React المبنية من نفس الخدمة
const dist = path.join(__dirname, "../../client/dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => err && res.status(404).send("Client not built. Run: npm run build"));
});
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "server_error", detail: err.message }); });

const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  if (!(await Family.exists({}))) { console.log("قاعدة فارغة: تهيئة أولية…"); await seed(); }
  startScheduler();
  app.listen(PORT, () => console.log(`API على المنفذ ${PORT}`));
}).catch((e) => { console.error("فشل الاتصال بـ MongoDB:", e.message); process.exit(1); });
