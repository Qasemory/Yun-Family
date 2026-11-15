// حفظ الصور المصغّرة بقاعدة البيانات (قرص Render مؤقت). الرابط سرّي وطويل: /api/img/<key>
import crypto from "node:crypto";
import { Image } from "../models/index.js";

const MAX_BYTES = 1.5 * 1024 * 1024;
const OK = new Set(["image/jpeg", "image/png", "image/webp"]);

/** يحفظ data URL ويرجع رابطه، أو null إذا الصورة غير صالحة */
export async function saveImage(dataUrl, { family, owner, purpose } = {}) {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ""));
  if (!m || !OK.has(m[1])) return null;
  const data = Buffer.from(m[2], "base64");
  if (!data.length || data.length > MAX_BYTES) return null;
  const key = crypto.randomBytes(18).toString("hex");
  await Image.create({ key, family, owner, mime: m[1], data, size: data.length, purpose });
  return `/api/img/${key}`;
}

export async function deleteImage(url) {
  const key = /\/api\/img\/([a-f0-9]{36})$/.exec(String(url || ""))?.[1];
  if (key) await Image.deleteOne({ key });
}

export async function serveImage(req, res) {
  if (!/^[a-f0-9]{36}$/.test(req.params.key)) return res.status(404).end();
  const img = await Image.findOne({ key: req.params.key }).lean();
  if (!img) return res.status(404).end();
  res.set({ "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  res.send(Buffer.from(img.data.buffer || img.data));
}
