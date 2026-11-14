// إدارة متجر رنا (يون كروشيه) + الصفحة العامة
import { Router } from "express";
import { requireAuth, isParent } from "../middleware/auth.js";
import { Product, Order, Customer, Yarn, User, Notification } from "../models/index.js";
import { getSettings, setSetting, brandFrom } from "../utils/settings.js";
import { today, addDays } from "../utils/dates.js";

const pub = Router();      // بدون تسجيل دخول
const admin = Router();    // رنا وقاسم

async function shopOwner() {
  return (await User.findOne({ role: "admin", isActive: true }).lean()) || (await User.findOne({ role: "owner" }).lean());
}
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-|-$/g, "") || `p-${Date.now()}`;

/** أقرب تسليم حقيقي: ساعات الطلبات المفتوحة ÷ الساعات المحمية أسبوعياً */
async function earliestDelivery(ownerId, hours, days, protectedHours) {
  const open = await Order.find({ owner: ownerId, status: { $in: ["accepted", "in_progress"] } }).populate("product", "hours").lean();
  const backlog = open.reduce((a, o) => a + (o.product?.hours || 0), 0) + hours;
  const weeks = Math.ceil(backlog / Math.max(protectedHours, 1)) - 1;
  return addDays(today(), days + Math.max(weeks, 0) * 7);
}

async function storefront(lang = "ar") {
  const owner = await shopOwner();
  const s = await getSettings(owner.family);
  const brand = brandFrom(s);
  const products = await Product.find({ owner: owner._id, active: true }).populate("colors").lean();
  const protectedHours = Number(s.protected_hours_week || 8);
  const items = [];
  for (const p of products) {
    items.push({ ...p, colors: (p.colors || []).map((y) => ({ id: y._id, color: y.color, hex: y.hex, available: y.grams >= 50 })), earliest: await earliestDelivery(owner._id, p.hours, p.days, protectedHours) });
  }
  const colorsInStock = await Yarn.countDocuments({ owner: owner._id, grams: { $gte: 50 } });
  return { brand, products: items, colorsInStock, earliestAny: items.map((p) => p.earliest).sort()[0] || null, lang };
}

pub.get("/", async (req, res) => res.json(await storefront(req.query.lang === "en" ? "en" : "ar")));
pub.get("/p/:slug", async (req, res) => {
  const sf = await storefront(req.query.lang === "en" ? "en" : "ar");
  const p = sf.products.find((x) => x.slug === req.params.slug);
  if (!p) return res.status(404).json({ error: "not_found" });
  res.json({ brand: sf.brand, product: p });
});
pub.post("/order", async (req, res) => {
  const { slug, firstName, phone, options, lang } = req.body || {};
  const owner = await shopOwner();
  const p = await Product.findOne({ slug, owner: owner._id, active: true });
  if (!p || !firstName) return res.status(400).json({ error: "bad_input" });
  const s = await getSettings(owner.family);
  const brand = brandFrom(s);
  const due = await earliestDelivery(owner._id, p.hours, p.days, Number(s.protected_hours_week || 8));
  let customer = phone ? await Customer.findOne({ owner: owner._id, phone }) : null;
  if (!customer) customer = await Customer.create({ owner: owner._id, firstName, phone });
  const order = await Order.create({ owner: owner._id, product: p._id, customer: customer._id, customerName: firstName, options: options || {}, price: p.price, due, lang: lang === "en" ? "en" : "ar" });
  const deposit = Math.max(5, Math.round(p.price * 0.35));
  const reply = `أهلاً ${firstName}، ${p.nameAr} بـ ${p.price} د، أقرب تسليم ${due}. عربون ${deposit} د عبر CliQ لنبدأ.\n${brand.signature}`;
  await Notification.create({ user: owner._id, kind: "order", body: `طلب جديد: ${p.nameAr} من ${firstName}` });
  res.json({ ok: true, orderId: order._id, due, price: p.price, suggestedReply: reply, whatsapp: brand.whatsapp });
});

admin.use(requireAuth, (req, res, next) => (isParent(req.user.role) ? next() : res.status(403).json({ error: "parents_only" })));

admin.get("/", async (req, res) => {
  const owner = await shopOwner();
  const [products, yarn, orders, s] = await Promise.all([
    Product.find({ owner: owner._id }).populate("colors").lean(), Yarn.find({ owner: owner._id }).lean(),
    Order.find({ owner: owner._id }).populate("product", "nameAr nameEn hours price").sort({ createdAt: -1 }).limit(200).lean(), getSettings(owner.family),
  ]);
  const month = today().slice(0, 7);
  const delivered = orders.filter((o) => o.status === "delivered" && o.updatedAt.toISOString().startsWith(month));
  const openHours = orders.filter((o) => ["accepted", "in_progress"].includes(o.status)).reduce((a, o) => a + (o.product?.hours || 0), 0);
  res.json({ brand: brandFrom(s), products, yarn, orders, finance: { monthRevenue: delivered.reduce((a, o) => a + (o.price || 0), 0), monthOrders: delivered.length, openHours, protectedHours: Number(s.protected_hours_week || 8) } });
});
admin.post("/product", async (req, res) => {
  const owner = await shopOwner();
  const b = req.body || {};
  const p = await Product.create({ owner: owner._id, slug: b.slug ? slugify(b.slug) : slugify(b.nameEn || b.nameAr), nameAr: b.nameAr, nameEn: b.nameEn, descAr: b.descAr, descEn: b.descEn, category: b.category, price: +b.price, hours: +b.hours || 4, days: +b.days || 5, colors: b.colors || [], imageUrl: b.imageUrl });
  res.json(p);
});
admin.patch("/product/:id", async (req, res) => res.json(await Product.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
admin.post("/yarn", async (req, res) => { const owner = await shopOwner(); res.json(await Yarn.create({ owner: owner._id, ...req.body })); });
admin.patch("/yarn/:id", async (req, res) => res.json(await Yarn.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
admin.patch("/order/:id", async (req, res) => {
  const { status } = req.body || {};
  const o = await Order.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
  res.json(o);
});
// بطاقة الهدية A6
admin.get("/gift/:orderId", async (req, res) => {
  const o = await Order.findById(req.params.orderId).populate("product").lean();
  if (!o) return res.status(404).json({ error: "not_found" });
  const lang = req.query.lang || o.lang || "ar";
  const owner = await shopOwner();
  const brand = brandFrom(await getSettings(owner.family));
  const recipient = (o.options?.name || o.customerName || "").trim();
  const third = !!o.options?.name && o.options.name.trim() !== (o.customerName || "").trim();
  res.json({
    lang, brand, recipient, thirdParty: third,
    line: lang === "ar" ? (third ? `${brand.name} هذي لكة، بطلب من قلب يحبّك.` : `${brand.name} هذي لكة.`) : (third ? `This ${brand.nameEn} is for you, ordered by someone who loves you.` : `This ${brand.nameEn} is for you.`),
    front: lang === "ar" ? brand.craft : brand.craftEn, product: lang === "ar" ? o.product.nameAr : (o.product.nameEn || o.product.nameAr),
    care: lang === "ar" ? "غسيل يدوي · ماء بارد · تجفيف مسطّح" : "Hand wash · cold water · dry flat",
  });
});
// وصف إنستغرام لمنتج
admin.get("/caption/:id", async (req, res) => {
  const p = await Product.findById(req.params.id).lean();
  const owner = await shopOwner();
  const brand = brandFrom(await getSettings(owner.family));
  res.json({ ar: `${p.nameAr} صناعة يدوية حسب الطلب خلال ${p.days} أيام. ${brand.hashtags}`, en: `Handmade ${p.nameEn || p.nameAr}, made to order in ${p.days} days. ${brand.hashtagsEn}` });
});
// إعدادات الهوية
admin.post("/brand", async (req, res) => {
  const owner = await shopOwner();
  const allowed = ["shop_name", "shop_name_en", "shop_descriptor", "shop_descriptor_en", "shop_tagline", "shop_tagline_en", "shop_tagline_craft", "shop_tagline_craft_en", "shop_tagline_tr", "shop_instagram", "shop_whatsapp", "protected_hours_week"];
  for (const k of allowed) if (req.body?.[k] !== undefined) await setSetting(owner.family, k, req.body[k]);
  res.json({ brand: brandFrom(await getSettings(owner.family)) });
});

export { pub as storePublic, admin as shopAdmin };
