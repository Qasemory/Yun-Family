// طبقة الذكاء الاصطناعي (Claude) — نقطة واحدة لكل الميزات.
// بدون ANTHROPIC_API_KEY: كل دالة ترجع null والتطبيق يكمل بالقواعد البسيطة.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 300); // سقف حماية للفاتورة
let client = null;
let usage = { day: "", calls: 0, input: 0, output: 0 };

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY;
export const aiUsage = () => ({ ...usage, limit: DAILY_LIMIT, model: MODEL, ready: aiReady() });

function getClient() {
  if (!client) client = new Anthropic({ timeout: 120_000, maxRetries: 2 });
  return client;
}
function underLimit() {
  const d = new Date().toISOString().slice(0, 10);
  if (usage.day !== d) usage = { day: d, calls: 0, input: 0, output: 0 };
  return usage.calls < DAILY_LIMIT;
}

/** صورة من المتصفح (data URL) ← بلوك صورة لـ Claude. يرجع null إذا الصيغة غير مدعومة. */
export function imageBlock(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
}

/**
 * طلب واحد يرجع JSON مطابق للـ schema (structured outputs).
 * content: نص أو مصفوفة بلوكات (صور + نص). يرجع الكائن أو null عند أي فشل.
 */
export async function askJSON({ system, content, schema, effort = "low", maxTokens = 8000, tag = "ai" }) {
  if (!aiReady()) return null;
  if (!underLimit()) { console.warn(`[${tag}] تجاوز السقف اليومي AI_DAILY_LIMIT=${DAILY_LIMIT}`); return null; }
  usage.calls++;
  try {
    const res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
    });
    usage.input += res.usage?.input_tokens || 0;
    usage.output += res.usage?.output_tokens || 0;
    if (res.stop_reason === "refusal") { console.warn(`[${tag}] رفض:`, res.stop_details?.category || ""); return null; }
    if (res.stop_reason === "max_tokens") { console.warn(`[${tag}] الرد انقطع (max_tokens)`); return null; }
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.error(`[${tag}] مفتاح ANTHROPIC_API_KEY غير صالح`);
    else if (e instanceof Anthropic.RateLimitError) console.warn(`[${tag}] ضغط على الخدمة، حاول لاحقاً`);
    else if (e instanceof Anthropic.BadRequestError) console.error(`[${tag}] طلب غير صالح:`, e.message);
    else if (e instanceof Anthropic.APIError) console.error(`[${tag}] خطأ API ${e.status}:`, e.message);
    else console.error(`[${tag}]`, e.message);
    return null;
  }
}

// مساعد لبناء schema صارم بسرعة
export const S = {
  str: () => ({ type: "string" }),
  int: () => ({ type: "integer" }),
  bool: () => ({ type: "boolean" }),
  arr: (items) => ({ type: "array", items }),
  enum: (values) => ({ type: "string", enum: values }),
  obj: (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false }),
};
