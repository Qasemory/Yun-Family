# عيلتنا — مساعد عيلة الأمعري (React + Express + MongoDB)

نسخة الويب من التطبيق العائلي: حسابات بصلاحيات (الأب يرى الكل، الأم ترى الأولاد ونفسها، كل ولد حسابه)، مهام ونقاط وترفيه يُفتح بالإنجاز، صلاتي وأذكاري، دراسة IG بالإنجليزي، فحص الأحد (الوزن) مع ربط الميزان، عيلتنا، ومتجر **يون كروشيه** بصفحة عامة وبطاقة هدية.

```
yun-family/
├─ server/        Express + Mongoose (API + يخدم واجهة React المبنية)
│  └─ src/        index.js · seed.js · scheduler.js · models · routes · utils · middleware
├─ client/        Vite + React 18 + Tailwind (RTL، Readex Pro، نسخ مدرسي لنصوص الأولاد)
├─ render.yaml    نشر بضغطة على Render (Blueprint)
└─ .env.example   متغيرات البيئة
```

## ١) التشغيل محلياً

```bash
git clone <repo> && cd yun-family
npm run install:all                       # يثبّت server و client
cp .env.example server/.env               # وعدّل MONGODB_URI و JWT_SECRET
npm run dev                               # API على 5000 + واجهة على 5173
```
أول تشغيل على قاعدة فارغة يُنشئ عائلة الأمعري تلقائياً (أو `npm run seed`، و`SEED_FORCE=1 npm run seed` لإعادة التهيئة).

| من | الدخول الأولي (غيّره فوراً من الإعدادات) |
|---|---|
| قاسم | `Qasem-Change-Me-2026` |
| رنا | `Rana-Change-Me-2026` |
| ماسة | PIN `1357` |
| نور الدين | PIN `2460` |

الصفحة العامة للمتجر: `http://localhost:5173/store` (وبالإنجليزي `?lang=en`).

## ٢) MongoDB Atlas (مجاني)
1. أنشئ حساباً على mongodb.com/atlas → **Create Cluster** (M0 Free) في أقرب منطقة (Frankfurt).
2. **Database Access** → أضف مستخدماً بكلمة سر.
3. **Network Access** → Add IP → `0.0.0.0/0` (Render لا يملك IP ثابتاً على الخطة المجانية).
4. **Connect → Drivers** → انسخ الرابط، وضع اسم القاعدة `yunfamily` قبل `?`:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/yunfamily?retryWrites=true&w=majority`

## ٣) GitHub
```bash
cd yun-family
git init && git add . && git commit -m "yun-family: initial"
git branch -M main
git remote add origin https://github.com/<user>/yun-family.git
git push -u origin main
```
`.env` مستثنى من Git تلقائياً.

## ٤) Render
**الطريقة الأسهل (Blueprint):** Render → New → **Blueprint** → اختر المستودع؛ سيقرأ `render.yaml` ويطلب منك `MONGODB_URI` فقط (JWT_SECRET يُولَّد تلقائياً).

**أو يدوياً:** New → Web Service → المستودع →
- Runtime: Node · Build Command: `npm run build` · Start Command: `npm start`
- Environment: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `TZ=Asia/Amman`
- Health Check Path: `/healthz`

الخدمة الواحدة تخدم الـ API والواجهة معاً (`client/dist`)، والجدولة (تذكير الصلاة، فحص الأحد، ملخص المساء) تعمل داخلها بـ node-cron. على الخطة المجانية تنام الخدمة بعد ١٥ دقيقة خمول، فالتذكيرات قد تتأخر حتى أول زيارة؛ خطة Starter تحلّها، أو شغّل مراقباً مجانياً (UptimeRobot) يطرق `/healthz` كل ١٠ دقائق.

## ٥) ربط الميزان
من صفحة الصحة → «ربط الميزان» → «أنشئ رمز الربط». ثم أي مصدر يرسل:
```
POST https://<your-app>.onrender.com/api/scale
{"token":"...", "weight_kg": 62.4, "height_cm": 163}
```
آيفون: الاختصارات ← أتمتة ← «عند تسجيل عينة وزن في الصحة» ← «الحصول على محتويات URL» (POST). أندرويد: Health Connect عبر MacroDroid/IFTTT.

## ٦) واجهة الـ API (مختصر)
| المسار | الغرض |
|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` · `/notifications` · `/change-password` · `/reset-pin` · `/language` | الدخول والحسابات |
| `GET /api/tasks/plan?u=` · `POST /api/tasks/:id/done` · `/completion/:id/confirm` · `/pending` · `/manage` · `/ledger` | المهام والنقاط والترفيه |
| `GET /api/prayer?u=` · `POST /api/prayer/log` · `/confirm/:uid` · `/dhikr/:slot` | الصلاة والأذكار |
| `GET /api/health?u=` · `POST /api/health/weight` · `/goal` · `/daily` · `/profile` · `/scale-link` · `POST /api/scale` | فحص الأحد والصحة |
| `GET /api/store` · `/store/p/:slug` · `POST /api/store/order` | الصفحة العامة (بدون حساب) |
| `GET /api/shop` · `POST /shop/product` · `/yarn` · `PATCH /shop/order/:id` · `GET /shop/gift/:orderId` · `/caption/:id` · `POST /shop/brand` | إدارة المتجر (رنا وقاسم) |
| `GET/POST /api/family` · `/:id/approve` · `/:id/touch` | عيلتنا |
| `GET /api/study?u=` · `POST /study/book` · `/book/:id/page` · `/prepare` · `/lesson/:id/(start|point|exam|finish)` | الدراسة |
| `GET/POST /api/settings` · `/audit` | الإعدادات (الأهل) |

## ٧) ما نُقل من النسخة السابقة وما يأتي لاحقاً
**منقول:** الصلاحيات، الدخول بكلمة سر/PIN مع القفل، المهام والنقاط والترفيه، الصلاة والأذكار ولوحة الفجر، فحص الأحد كاملاً (اتجاه، رسائل، رؤية الولد، نطاق WHO، تنبيهات، الميزان)، المتجر (كتالوج، خيوط، طلبات، أقرب تسليم، حارس الوقت، بطاقة الهدية، وصف إنستغرام، الهوية من الإعدادات)، عيلتنا (نشر بموافقة، لمسات)، الدراسة (كتاب ← صفحة ← درس بقواعد ← نقاط ← اختبار ← ملخص)، الجدولة.

**المرحلة التالية (لم تُنقل بعد):** بوت تيليجرام/واتساب، التحقق بخطوتين TOTP، الذكاء الاصطناعي لتحضير الدروس من الصور وفحص الوجوه، النشر الآلي على إنستغرام، التحكم بأجهزة الأولاد، مشاريع الكروشيه (عدّاد الصفوف/المؤقّت)، اللغات، برامج قاسم (العمل/المال/القرارات)، صديقي، الرحلة والشارات، رفع الصور (يحتاج تخزين مثل Cloudinary لأن قرص Render مؤقت).

## ملاحظات
- جداول النطاق الصحي للأطفال تقريبية (WHO 2007)؛ الطبيب هو المرجع. تاريخ الميلاد والجنس يُصحَّحان من صفحة الصحة.
- مواقيت الصلاة في `scheduler.js` ثابتة تقريبية لعمّان؛ اربطها بمصدر مواقيت عند الحاجة.
- الإشعارات داخل التطبيق دائماً، وعبر تيليجرام إن وُضع `TELEGRAM_BOT_TOKEN` وربط `telegramChatId` للمستخدم.
