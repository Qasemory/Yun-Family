import { Setting } from "../models/index.js";

export const DEFAULTS = {
  points_per_dinar: "100", monthly_reward_cap_jod: "30", savings_ratio: "0.30",
  fun_minutes_weekday_stage4: "45", fun_minutes_weekday_stage6: "60",
  fun_minutes_weekend_stage4: "90", fun_minutes_weekend_stage6: "120",
  // هوية المتجر «يون كروشيه»
  shop_name: "يون", shop_name_en: "Yün", shop_descriptor: "كروشيه", shop_descriptor_en: "Crochet",
  shop_tagline: "صُنع بحب لكة", shop_tagline_en: "Made with love, for you",
  shop_tagline_craft: "صُنعت بحب، غرزة غرزة", shop_tagline_craft_en: "Made with love, stitch by stitch",
  shop_tagline_tr: "Yün, sevgiyle", shop_instagram: "yun.jo", shop_whatsapp: "",
  protected_hours_week: "8", hourly_rate_jod: "4",
};

export async function getSettings(familyId) {
  const rows = await Setting.find({ family: familyId }).lean();
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
export async function setSetting(familyId, key, value) {
  await Setting.updateOne({ family: familyId, key }, { $set: { value: String(value) } }, { upsert: true });
}
export function brandFrom(s) {
  const handle = (s.shop_instagram || "yun.jo").split(".")[0].toLowerCase();
  return {
    name: s.shop_name, nameEn: s.shop_name_en, descriptor: s.shop_descriptor, descriptorEn: s.shop_descriptor_en,
    fullName: `${s.shop_name} ${s.shop_descriptor}`.trim(), fullNameEn: `${s.shop_name_en} ${s.shop_descriptor_en}`.trim(),
    tagline: s.shop_tagline, taglineEn: s.shop_tagline_en, craft: s.shop_tagline_craft, craftEn: s.shop_tagline_craft_en,
    taglineTr: s.shop_tagline_tr, instagram: s.shop_instagram, whatsapp: s.shop_whatsapp,
    signature: `${s.shop_name}، لكة.`,
    hashtags: `#${s.shop_name}_${s.shop_descriptor} #${handle} ${s.shop_tagline.replace(/ /g, "_")} #كروشيه_عمان`,
    hashtagsEn: `#${handle} #${handle}crochet #madewithlove #crochetamman`,
    colors: { cream: "#FBF6EE", brown: "#A8683F", ink: "#4A3328", rose: "#C98B8B", night: "#2B1D16", sand: "#EADBC8" },
  };
}
