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

**نسيت كلمة السر؟** الأب والأم يضيفون إيميلهم من الإعدادات ← الأمان والدخول ويؤكدونه، فتصير الاستعادة بالإيميل ممكنة (`/family/forgot`). تحتاج على Render: `GMAIL_USER` و`GMAIL_APP_PASSWORD` (App Password من جيميل بعد تفعيل التحقق بخطوتين)، واختيارياً `APP_URL`. الأب يقدر يعيد ضبط كلمة سر الأم من نفس القسم.

**الذكاء الاصطناعي (Claude):** على Render حط `ANTHROPIC_API_KEY` بخدمة الباك. هيك بتشتغل هالميزات:
- **الخطة الأسبوعية:** الأهل بيصوّروا خطة المدرسة (لحد ٣ صور) وClaude بيطلّع لكل يوم المادة والكتاب والصفحات، وإذا الخطة بتكتب اسم الوحدة بس بيستعمل فهرس الكتاب. كل يوم ١٩:٠٠ (وفرصة تانية ٢١:٠٠) درس بكرا بيتحضّر من الصفحات المحفوظة، وإذا ناقصة بيوصل الأهل إشعار «صوّر صفحة 42». أول ما آخر صفحة ناقصة تنحفظ الدرس بيتحضّر لحاله. درس اليوم بيطلع محطة بقطار المهام. الكتاب ممكن ينرفع PDF (بيتقرأ بالمتصفح، والصفحات المصوّرة بتنقرأ بالذكاء لمدى بتختاره)، أو تنصوّر وحدة كاملة مرة وحدة. السيرفر المجاني إذا كان نايم الساعة ٧ بيعمل الفحص أول ما يصحى.
- **الدراسة:** تقرأ صورة صفحة الكتاب وتحوّلها لنص، وتحضّر الدرس (شرح بسيط ومثال وعربي وأسئلة فهم)، وتصحح أجوبة الولد بالمعنى، وفي زر "Explain again"، وبتصحح الاختبار وبتكتب ملاحظة لكل سؤال، وبتكتب تقرير للأهل.
- **المراجعة الذكية:** بتشتغل بدون AI، وبتعمل درس من النقاط اللي غلط فيها الولد.
- **المتجر:** تكتب الاسم والوصف من ملاحظات أو صورة القطعة، ووصف إنستغرام، ورد واتساب جاهز لكل طلب.
- **المهام:** تقترح مهام مناسبة لعمر الولد.
- **عيلتنا:** فحص مبدئي لمنشورات الولاد، وأي شي بيقلق بيروح لموافقة الأهل مع السبب.
- **الصحة:** رسالة الأحد بتصير شخصية، وبدون أي حكي عن الوزن أو الأكل.

بدون المفتاح كل شي بيشتغل بالطريقة البسيطة. `AI_DAILY_LIMIT` (الافتراضي 300) بيحمي من فاتورة كبيرة، وبتشوف استهلاك اليوم بالإعدادات.

الدخول من `/family/login` بكتابة **الاسم** (كما هو محفوظ، مثل «قاسم» أو «نور الدين») ثم كلمة السر أو الـ PIN. لا تُعرض قائمة الأسماء للزوار.

| من | الدخول الأولي (غيّره فوراً من الإعدادات) |
|---|---|
| قاسم | `Qasem-Change-Me-2026` |
| رنا | `Rana-Change-Me-2026` |
| ماسة | PIN `1357` |
| نور الدين | PIN `2460` |

الصفحة العامة للمتجر على الجذر: `http://localhost:5173/` (صفحة منتج: `/p/<slug>`، وبالإنجليزي `?lang=en`). تطبيق العيلة تحت `http://localhost:5173/family` (الدخول: `/family/login`).

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
- Environment: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `TZ=Asia/Riyadh`
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
| `POST /study/book/:id/pages` (لحد ٤٠) · `GET /study/book/:id/pages` · `POST /study/book/:id/toc` · `DELETE /study/book/:id` | صفحات كتيرة (PDF أو وحدة مصوّرة)، الفهرس، حذف كتاب |
| `GET /study/plan?u=&week=` · `POST /study/plan/read` · `PUT /study/plan` · `POST /study/plan/item/:id/prepare` | الخطة الأسبوعية: قراءة صور الخطة، حفظها، تحضير بند |
| `GET/POST /api/settings` · `/audit` | الإعدادات (الأهل) |
| `GET/POST /api/tasks/manage` · `PATCH/DELETE /manage/:id` · `/completion/:id/reject` · `POST /tasks/points` | إدارة مهام الأولاد، الرفض، المكافأة والخصم (الأهل) |
| `GET /api/journey?u=` · `/journey/rewards` · `/rewards/:id/redeem` · `/redemptions/:id/(approve\|reject)` · `/family-goal` | القطار، نجوم الأسبوع، الشارات، المكافآت، قطار العيلة |
| `GET/POST /api/friend` | صديقي (محادثة الأولاد، يراها الأهل) |
| `/api/programs/(work\|money\|decisions)` · `/summary` · `/decisions/:id/think` | برامجي: الأعمال والمال والقرارات (خاصة بكل واحد من الأهل) |
| `/api/shop/projects` · `/projects/:id/(row\|start\|stop\|done…)` | مشاريع الكروشيه: عدّاد الصفوف والمؤقّت |
| `POST /api/auth/2fa/(setup\|enable\|disable\|reset-for)` | التحقق بخطوتين للأهل |
| `/api/telegram/(status\|link\|unlink)` · `/hook/:secret` | بوت تيليجرام |
| `GET /api/push/key` · `POST /api/push/(subscribe\|unsubscribe\|test)` · `GET /push/status` | إشعارات الموبايل (Web Push) |
| `GET /api/img/:key` | الصور المخزّنة (منتجات، إثبات المهام، منشورات) |

## ٧) ما نُقل من النسخة السابقة وما يأتي لاحقاً
**منقول:** الصلاحيات، الدخول بكلمة سر/PIN مع القفل، المهام والنقاط والترفيه، الصلاة والأذكار ولوحة الفجر، فحص الأحد كاملاً (اتجاه، رسائل، رؤية الولد، نطاق WHO، تنبيهات، الميزان)، المتجر (كتالوج، خيوط، طلبات، أقرب تسليم، حارس الوقت، بطاقة الهدية، وصف إنستغرام، الهوية من الإعدادات)، عيلتنا (نشر بموافقة، لمسات)، الدراسة (كتاب ← صفحة ← درس بقواعد ← نقاط ← اختبار ← ملخص)، الجدولة.

**أُضيف بعدها:** إدارة مهام كاملة للأهل (إضافة/تعديل/إيقاف/حذف، أيام، لازمة/تأكيد/صورة، رفض مع سبب، مكافأة وخصم)، رحلة المهام (قطار اليوم، نجوم الأسبوع مع يوم سماح، ١٢ شارة، متجر مكافآت بموافقة الأهل، قطار العيلة الشهري)، التحقق بخطوتين TOTP، بوت تيليجرام (ربط برمز، إشعارات، /today /points /done)، صديقي، برامجي (الأعمال/المال/القرارات + «ساعدني أفكر»)، مشاريع الكروشيه (عدّاد الصفوف والمؤقّت)، رفع الصور (مخزّنة بقاعدة البيانات، بدون Cloudinary)، وكل الذكاء الاصطناعي.

**ما لم يُبنَ وسببه:** بوت واتساب (يحتاج حساب WhatsApp Business API موثّق من Meta)، النشر الآلي على إنستغرام (يحتاج حساب أعمال وموافقة Meta على التطبيق؛ الوصف الجاهز موجود ويُنسخ بكبسة)، التحكم بأجهزة الأولاد (ما بيصير من موقع ويب؛ استعملوا Google Family Link أو Screen Time)، فحص الوجوه (بيانات حيوية حساسة للأطفال، فتركناه عمداً).

## ملاحظات
- جداول النطاق الصحي للأطفال تقريبية (WHO 2007)؛ الطبيب هو المرجع. تاريخ الميلاد والجنس يُصحَّحان من صفحة الصحة.
- مواقيت الصلاة في `scheduler.js` ثابتة تقريبية لعمّان؛ اربطها بمصدر مواقيت عند الحاجة.
- الإشعارات داخل التطبيق دائماً، وعلى الموبايل (Web Push) لكل جهاز فعّلها من الإعدادات، وعبر تيليجرام إن وُضع `TELEGRAM_BOT_TOKEN` وربط الحساب.
- إشعارات الموبايل ما بتحتاج أي إعداد: مفاتيح VAPID بتنعمل أول مرة وبتنحفظ بقاعدة البيانات (أو حطها بـ `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`). على الآيفون لازم «إضافة إلى الشاشة الرئيسية» أولاً (iOS 16.4+).
