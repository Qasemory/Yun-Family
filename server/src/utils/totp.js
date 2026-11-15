// التحقق بخطوتين (RFC 6238): رمز من 6 أرقام يتغيّر كل 30 ثانية (Google Authenticator / Microsoft Authenticator)
import crypto from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function base32Decode(s) {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) { const v = B32.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, "0"); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function codeAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}
/** يقبل الرمز الحالي أو السابق أو اللاحق (فرق ساعة الجهاز) */
export function verifyTotp(secret, code, now = Date.now()) {
  const c = String(code || "").replace(/\s/g, "");
  if (!secret || !/^\d{6}$/.test(c)) return false;
  const t = Math.floor(now / 30000);
  return [-1, 0, 1].some((w) => crypto.timingSafeEqual(Buffer.from(codeAt(secret, t + w)), Buffer.from(c)));
}
export const otpauthUrl = (secret, label, issuer = "Our Family") => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
