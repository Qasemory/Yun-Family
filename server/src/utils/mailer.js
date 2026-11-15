// إرسال الإيميلات عبر جيميل (App Password). بدون إعداد: لا يُرسل شيء ويُسجَّل تحذير فقط.
import nodemailer from "nodemailer";

let transporter = null;
export const mailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

function getTransporter() {
  if (!mailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
    });
  }
  return transporter;
}

/** عنوان الواجهة الذي تُبنى عليه روابط الإيميل */
export function appUrl() {
  const raw = process.env.APP_URL || (process.env.CLIENT_ORIGIN || "").split(",")[0] || "http://localhost:5173";
  return raw.trim().replace(/\/$/, "");
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** قالب بسيط بالعربي: عنوان، فقرة، وزر اختياري */
export function layout({ title, body, button }) {
  const btn = button ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#1F7A6D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">${esc(button.label)}</a></p><p style="font-size:12px;color:#5F6B68">إذا الزر ما اشتغل، انسخ هالرابط:<br><span dir="ltr" style="word-break:break-all">${esc(button.url)}</span></p>` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F6F3EC;font-family:Tahoma,Arial,sans-serif;color:#1E2A28">
<div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border:1px solid #E6E2DA;border-radius:16px;padding:24px">
<h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2><p style="line-height:1.8;margin:0">${esc(body)}</p>${btn}
</div><p style="font-size:11px;color:#5F6B68;text-align:center;margin-top:16px">عيلتنا · رسالة تلقائية، لا ترد عليها.</p></div></body></html>`;
}

export async function sendMail({ to, subject, title, body, button }) {
  const t = getTransporter();
  if (!t) { console.warn("[mail] GMAIL_USER / GMAIL_APP_PASSWORD غير مضبوطين، لم يُرسل:", subject); return false; }
  try {
    const text = `${title}\n\n${body}${button ? `\n\n${button.label}: ${button.url}` : ""}`;
    await t.sendMail({ from: `"عيلتنا" <${process.env.GMAIL_USER}>`, to, subject, text, html: layout({ title, body, button }) });
    return true;
  } catch (e) {
    console.error("[mail] فشل الإرسال:", e.message);
    return false;
  }
}
