// يُنشئ عائلة الأمعري بأفرادها ومهامها ومتجر «يون كروشيه». شغّله مرة واحدة: npm run seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { Family, User, Task, Setting, Product, Yarn, HealthGoal, Book, Page } from "./models/index.js";
import { DEFAULTS } from "./utils/settings.js";

export const INITIAL = { qasem: "Qasem-Change-Me-2026", rana: "Rana-Change-Me-2026", masaPin: "1357", nourPin: "2460" };

const CHILD_TASKS = {
  stage4: [
    ["prayer", "صلاة الفجر", "05:30", 10, 15, 0, 0, 1], ["quran", "قرآن: ٣-٥ آيات حفظ + مراجعة", "05:45", 15, 10, 1, 1, 0], ["dhikr", "أذكار الصباح", "06:00", 4, 8, 0, 0, 0],
    ["study", "Study session (Stage 4)", "15:30", 25, 20, 1, 0, 0], ["sport", "رياضة ٣٠ دقيقة", "16:15", 30, 10, 1, 1, 0], ["language", "English: 5 new words", "17:00", 15, 5, 0, 0, 0],
    ["hobby", "هواية: مشروع الشهر", "17:30", 25, 5, 0, 0, 0], ["dhikr", "أذكار المساء", "17:00", 4, 8, 0, 0, 0], ["health", "نوم بالوقت ٨:٤٥", "20:45", 0, 5, 0, 0, 1],
  ],
  stage6: [
    ["prayer", "صلاة الفجر", "05:30", 10, 15, 0, 0, 1], ["quran", "قرآن: نصف صفحة حفظ + صفحتان مراجعة", "05:45", 20, 15, 1, 1, 0], ["dhikr", "أذكار الصباح", "06:05", 7, 8, 0, 0, 0],
    ["study", "Study session (Stage 6)", "15:30", 45, 20, 1, 0, 0], ["sport", "حركة ٤٠ دقيقة", "16:20", 40, 10, 1, 0, 0], ["language", "English: reading + 3 sentences", "17:05", 20, 10, 0, 0, 0],
    ["hobby", "هواية: كروشيه مع ماما / مشروع", "17:30", 30, 10, 0, 0, 0], ["dhikr", "أذكار المساء", "17:00", 7, 8, 0, 0, 0], ["health", "نوم بالوقت ٩:١٥", "21:15", 0, 5, 0, 0, 1],
  ],
};

export async function seed({ force = false } = {}) {
  if (await Family.exists({}) && !force) { console.log("القاعدة فيها بيانات. استخدم SEED_FORCE=1 لإعادة التهيئة."); return; }
  if (force) await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  const fam = await Family.create({ name: "عيلة الأمعري" });
  const h = (s) => bcrypt.hash(s, 10);
  const qasem = await User.create({ family: fam._id, role: "owner", displayName: "قاسم", fullName: "م. قاسم الأمعري", color: "#1F7A6D", passwordHash: await h(INITIAL.qasem), sex: "m" });
  const rana = await User.create({ family: fam._id, role: "admin", displayName: "رنا", fullName: "رنا النحاس", color: "#B8761A", passwordHash: await h(INITIAL.rana), sex: "f" });
  const masa = await User.create({ family: fam._id, role: "child", displayName: "ماسة", fullName: "ماسة الأمعري", grade: "Stage 6", color: "#7A4A8C", uiLanguage: "mixed", pinHash: await h(INITIAL.masaPin), sex: "f", birthDate: "2015-05-10" });
  const nour = await User.create({ family: fam._id, role: "child", displayName: "نور الدين", fullName: "نور الدين الأمعري", grade: "Stage 4", color: "#2F6B8F", uiLanguage: "mixed", pinHash: await h(INITIAL.nourPin), sex: "m", birthDate: "2017-04-02" });
  for (const [u, key] of [[masa, "stage6"], [nour, "stage4"]]) {
    await Task.insertMany(CHILD_TASKS[key].map(([domainKey, title, preferredTime, durationMin, points, mandatory, needsProof, needsParentConfirm]) => ({ user: u._id, domainKey, title, preferredTime, durationMin, points, mandatory: !!mandatory, needsProof: !!needsProof, needsParentConfirm: !!needsParentConfirm })));
  }
  await Setting.insertMany(Object.entries(DEFAULTS).map(([key, value]) => ({ family: fam._id, key, value })));
  await HealthGoal.create({ user: masa._id, direction: "down", source: "parent", visibility: "number", note: "بقرار الأهل: ماسة ترى الرقم" });
  await HealthGoal.create({ user: nour._id, direction: "up", source: "parent", visibility: "trend" });
  // متجر رنا
  const yarn = await Yarn.insertMany([
    { owner: rana._id, color: "بيج", hex: "#D9B28F", grams: 400 }, { owner: rana._id, color: "وردي مغبّر", hex: "#C98B8B", grams: 250 },
    { owner: rana._id, color: "زيتي", hex: "#8FA38A", grams: 120 }, { owner: rana._id, color: "كريمي", hex: "#E3D3BF", grams: 300 }, { owner: rana._id, color: "أزرق", hex: "#7C8FA6", grams: 30 },
  ]);
  await Product.insertMany([
    { owner: rana._id, slug: "newborn-set", nameAr: "طقم مولود", nameEn: "Newborn set", descAr: "قبعة وجوارب وبطانية صغيرة، قطن ناعم.", descEn: "Hat, booties and a small blanket in soft cotton.", category: "babies", price: 28, hours: 6, days: 7, colors: yarn.slice(0, 4).map((y) => y._id) },
    { owner: rana._id, slug: "bunny-doll", nameAr: "دمية أرنب", nameEn: "Bunny doll", descAr: "أميغورومي بحجم اليد.", descEn: "Hand-sized amigurumi.", category: "dolls", price: 20, hours: 4, days: 5, colors: yarn.slice(0, 2).map((y) => y._id) },
    { owner: rana._id, slug: "market-bag", nameAr: "شنطة سوق", nameEn: "Market bag", descAr: "شبكية قوية بخيط قطني.", descEn: "Strong cotton net bag.", category: "bags", price: 45, hours: 8, days: 10, colors: yarn.slice(2, 4).map((y) => y._id) },
  ]);
  // كتاب تجريبي لدرس
  const book = await Book.create({ user: nour._id, subject: "Science", title: "Cambridge Primary Science 4", stage: "Stage 4" });
  await Page.create({ book: book._id, number: 42, text: "Plants have different parts. The roots are under the soil. They hold the plant and take in water. The stem carries water to the leaves. Leaves make food for the plant using sunlight. Flowers make seeds so new plants can grow." });
  console.log("تمت التهيئة:", { qasem: qasem._id.toString(), rana: rana._id.toString(), masa: masa._id.toString(), nour: nour._id.toString() });
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  connectDB().then(() => seed({ force: process.env.SEED_FORCE === "1" })).then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
}
