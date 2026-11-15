import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ROLES = ["owner", "admin", "child", "teen_adult", "relative", "helper", "guest"];

const familySchema = new Schema({ name: { type: String, required: true } }, { timestamps: true });

const userSchema = new Schema({
  family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
  role: { type: String, enum: ROLES, required: true },
  displayName: { type: String, required: true },
  fullName: String,
  grade: String,                       // "Stage 4" | "Stage 6"
  color: { type: String, default: "#1F7A6D" },
  uiLanguage: { type: String, enum: ["ar", "en", "mixed"], default: "ar" },
  passwordHash: String,                // الكبار
  pinHash: String,                     // الأولاد
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  // الإيميل واستعادة كلمة السر (للأب والأم)
  email: { type: String, trim: true, lowercase: true, index: { unique: true, sparse: true } },
  emailVerified: { type: Boolean, default: false },
  emailTokenHash: String,
  emailTokenExpires: Date,
  resetTokenHash: String,
  resetTokenExpires: Date,
  resetRequestedAt: Date,
  tokenVersion: { type: Number, default: 0 },   // يزيد عند تغيير كلمة السر فيُخرج كل الأجهزة
  telegramChatId: String,
  isActive: { type: Boolean, default: true },
  sex: { type: String, enum: ["f", "m", null], default: null },
  birthDate: String,                   // YYYY-MM-DD
}, { timestamps: true });

const taskSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  domainKey: { type: String, required: true },
  title: { type: String, required: true },
  preferredTime: String,
  durationMin: { type: Number, default: 0 },
  points: { type: Number, default: 5 },
  mandatory: { type: Boolean, default: false },
  needsProof: { type: Boolean, default: false },
  needsParentConfirm: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  days: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },   // 0 = الأحد
}, { timestamps: true });

const completionSchema = new Schema({
  task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  day: { type: String, required: true, index: true },         // YYYY-MM-DD
  status: { type: String, enum: ["done", "pending_confirm", "rejected"], default: "done" },
  proofUrl: String,
  source: { type: String, default: "web" },
  confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
completionSchema.index({ task: 1, day: 1 }, { unique: true });

const pointsSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  delta: { type: Number, required: true },
  reason: String,
  ref: String,
  day: { type: String, index: true },
}, { timestamps: true });

const prayerLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  day: { type: String, required: true },
  prayer: { type: String, enum: ["fajr", "dhuhr", "asr", "maghrib", "isha"], required: true },
  status: { type: String, enum: ["mosque", "ontime", "late"], required: true },
  points: { type: Number, default: 0 },
  confirmed: { type: Boolean, default: true },
}, { timestamps: true });
prayerLogSchema.index({ user: 1, day: 1, prayer: 1 }, { unique: true });

const healthLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  day: { type: String, required: true },
  metric: { type: String, required: true },   // weight | height_cm | waist_cm | sleep_h | water_cups | mood | skill:*
  value: { type: Number, required: true },
  note: String,
}, { timestamps: true });
healthLogSchema.index({ user: 1, day: 1, metric: 1 }, { unique: true });

const healthGoalSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  targetLow: Number,
  targetHigh: Number,
  weeklyRate: { type: Number, default: 0.5 },
  direction: { type: String, enum: ["down", "up", "keep"], default: "keep" },
  source: String,
  note: String,
  visibility: { type: String, enum: ["number", "trend"], default: "trend" },
}, { timestamps: true });

const scaleLinkSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  token: { type: String, required: true, unique: true },
  provider: { type: String, default: "webhook" },
  lastSync: Date,
}, { timestamps: true });

const settingSchema = new Schema({
  family: { type: Schema.Types.ObjectId, ref: "Family", required: true },
  key: { type: String, required: true },
  value: { type: String, default: "" },
});
settingSchema.index({ family: 1, key: 1 }, { unique: true });

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, default: "info" },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

const auditSchema = new Schema({
  family: { type: Schema.Types.ObjectId, ref: "Family" },
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  action: String,
  detail: String,
  severity: { type: String, default: "info" },
}, { timestamps: true });

// ---- المتجر (يون كروشيه) ----
const yarnSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  color: String, hex: String, grams: { type: Number, default: 0 }, brand: String,
}, { timestamps: true });

const productSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  slug: { type: String, required: true, unique: true },
  nameAr: { type: String, required: true },
  nameEn: String,
  descAr: String, descEn: String,
  category: { type: String, default: "gifts" },
  price: { type: Number, required: true },
  hours: { type: Number, default: 4 },      // ساعات العمل
  days: { type: Number, default: 5 },       // أيام التسليم
  colors: [{ type: Schema.Types.ObjectId, ref: "Yarn" }],
  imageUrl: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

const customerSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  firstName: String, phone: String, notes: String,
}, { timestamps: true });

const orderSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  customer: { type: Schema.Types.ObjectId, ref: "Customer" },
  customerName: String,
  options: { type: Object, default: {} },   // { color, name, size, gift }
  price: Number,
  due: String,
  status: { type: String, enum: ["new", "accepted", "in_progress", "ready", "delivered", "declined"], default: "new" },
  lang: { type: String, default: "ar" },
}, { timestamps: true });

// ---- عيلتنا ----
const postSchema = new Schema({
  family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: String,
  imageUrl: String,
  kind: { type: String, default: "post" },  // post | story | achievement
  status: { type: String, enum: ["published", "pending"], default: "published" },
  touches: [{ user: { type: Schema.Types.ObjectId, ref: "User" }, kind: String, text: String }],
}, { timestamps: true });

// ---- الدراسة ----
const bookSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subject: String, title: String, stage: String,
}, { timestamps: true });

const pageSchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  number: Number, text: String, imageUrl: String,
}, { timestamps: true });

const lessonSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  book: { type: Schema.Types.ObjectId, ref: "Book" },
  title: String,
  forDay: String,
  objective: String,
  points: [{ text: String, question: String, answer: String, hint: String }],
  exam: [{ command: String, question: String, keywords: [String], marks: Number }],
  stage: { type: String, enum: ["warmup", "learn", "exam", "summary", "done"], default: "warmup" },
  currentPoint: { type: Number, default: 0 },
  score: Number,
  mastered: { type: Boolean, default: false },
  summary: String,
}, { timestamps: true });

export const Family = model("Family", familySchema);
export const User = model("User", userSchema);
export const Task = model("Task", taskSchema);
export const Completion = model("Completion", completionSchema);
export const PointsLedger = model("PointsLedger", pointsSchema);
export const PrayerLog = model("PrayerLog", prayerLogSchema);
export const HealthLog = model("HealthLog", healthLogSchema);
export const HealthGoal = model("HealthGoal", healthGoalSchema);
export const ScaleLink = model("ScaleLink", scaleLinkSchema);
export const Setting = model("Setting", settingSchema);
export const Notification = model("Notification", notificationSchema);
export const Audit = model("Audit", auditSchema);
export const Yarn = model("Yarn", yarnSchema);
export const Product = model("Product", productSchema);
export const Customer = model("Customer", customerSchema);
export const Order = model("Order", orderSchema);
export const Post = model("Post", postSchema);
export const Book = model("Book", bookSchema);
export const Page = model("Page", pageSchema);
export const Lesson = model("Lesson", lessonSchema);
export { ROLES };
