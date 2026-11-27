# دليل أبوحمص (Dalil Abo Hommos)

منصة مجتمعية رقمية شاملة لمركز ومدينة أبوحمص (البحيرة): دليل العيادات وحجز الأدوار الحي، المطاعم والطلب أونلاين، الدليفري الموحد، الطوارئ، العقارات، المكافحون، والتخفيضات، مع لوحة إدارة مركزية ولوحات تشغيل معزولة للشركاء (عيادات، مطاعم، كباتن).

## البنية والبنية التحتية للبيانات (Architecture & Collections)

- **الواجهة الأمامية:** React + Vite (PWA مدعومة)، Tailwind CSS، React Router، وmotion/lucide للواجهات. تُدار حالة التطبيق من خلال `src/context/AppContext.tsx`.
- **قاعدة البيانات:** Firestore (قاعدة `(default)`) مع قواعد أمان صارمة في `firestore.rules`. أهم المجموعات:
  - `places/{id}` — الدليل العام (عيادات، مطاعم، صيدليات، حرفيين، عقارات، مكافحون، عروض).
  - `categories` / `promo_filters` / `campaigns` — الأقسام، عوامل التصفية، والتخفيضات.
  - `clinic_queues/{doctorId}` + `clinic_tickets/{ticketId}` — طوابير العيادة وحجز الأدوار (كتابة موحدة عبر transaktions موحدة لضمان التزامن).
  - `restaurant_orders/{orderId}` + `delivery_rides/{rideId}` — طلبات المطاعم وطلبات الدليفري (مع لقطة سعر ملزمة `pricingSnapshot`).
  - `submissions` — بلاغات الأهالي، و`whatsapp_queue` لقائمة الواتساب.
  - `analytics_events/{id}` — أحداث التتبع (زيارة، نقر اتصال/واتساب، بحث) بشرط تسجيل الدخول لمنع السبام.
  - `public_settings/main` — الإعدادات العامة ومتغير `visitsCount` (لا يمكن تضخيمه إلا بزيادة `+1` بواسطة مستخدم مسجل).
  - `admins/{uid}` — سجل الأدوار (مشرف عام، مشرف، مراجع، شريك)؛ انظر قسم البذرة أدناه.
  - `finance_config` / `finance_settlements` — السجل المالي المخصص للمشرف العام فقط.
- **الدالة الخادمة:** `functions/api/orders/validate.ts` (تُنشر عبر Cloudflare Pages Functions) تتحقق من أسعار الطلبات من نقطة النهاية REST لـ Firestore باستخدام حساب خدمة، وتفشل بدلالة إذا غابت الإعدادات.
- تفاصيل التدقيق الشامل (ضوابط الوصول، التحقق، العزل) موثقة في **[`security_spec.md`](./security_spec.md)**.

## المتطلبات والتشغيل المحلي

- **Node.js 22+** أو **Bun 1.4+**
- **Firebase CLI** لنشر القواعد والفهارس (`npm i -g firebase-tools`)
- **Java 11+** فقط عند تشغيل اختبارات محاكي قواعد Firestore محلياً

```bash
# باستخدام bun (مفضّل) أو npm — كلاهما مدعوم:
bun install        # أو: npm install
bun run dev        # أو: npm run dev
```

## متغيرات البيئة

راجع ملف `.env.example` (لا تضع أي مفاتيح سرية داخل المستودع):
- متغيرات الواجهة تبدأ بـ `VITE_*` (مثل إعدادات Firebase و `VITE_GOOGLE_MAPS_API_KEY` إن لزم).
- متغيرات دالة Cloudflare Pages (`/functions/api/orders/validate.ts`):
  - `FIREBASE_PROJECT_ID` (مطلوب — الدالة ترجع `503` إذا غاب)
  - `FIRESTORE_DATABASE_ID` (مطلوب — الدالة ترجع `503` إذا غاب)
  - `FIREBASE_CLIENT_EMAIL` و `FIREBASE_PRIVATE_KEY`: حساب خدمة (Service Account) Firebase يُستخدم لتوثيق قراءة Firestore من الخادم، بحيث ينجح التحقق الفعلي للأسعار بدل `401`/`502`.
- **ملاحظة أمنيّة:** تتطلب قواعد Firestore الآن تسجيل دخول (`isSignedIn()`) لإنشاء الطلبات/الحجوزات/البلاغات/الأحداث، لمنع السبام. يُدعم **الدخول المجهول (Anonymous Auth)**، لذا تأكد من تفعيل `Anonymous Auth` في Firebase Authentication كي تبقى وظائف الأهالي (حجز العيادة، طلب المطعم، طلب الدليفري، إرسال البلاغ) تعمل دون الحاجة لحساب Google.

## الأوامر والفحوص

تُدعم الأوامر التالية عبر **bun** (`bun run <script>`) أو **npm** (`npm run <script>`):

```bash
bun run typecheck   # فحص TypeScript (tsc --noEmit) — أو: npm run typecheck
bun run lint        # فحص ESLint (src/**/*.ts(x) عبر typescript-eslint) + قواعد firestore.rules
bun run lint:rules  # فحص قواعد firestore.rules عبر @firebase/eslint-plugin-security-rules
bun run test        # اختبارات الوحدة: tsx --test (src/lib/__tests__/fixes.test.ts) + vitest run
bun run build       # بناء نسخة الإنتاج (dist/)
```

### تشغيل اختبارات محاكي قواعد Firestore (يتطلب Java 11+)

```bash
npx firebase-tools emulators:exec --only firestore "node --test tests/firestore.rules.test.mjs"
```

## النشر والإعداد

### 1. Firebase (Firestore Rules + Indexes + Auth)
1. تأكد من تفعيل **Google Sign-In** في `Firebase Authentication` وإضافة نطاق موقعك الإنتاجي (ونطاق Cloudflare Pages) داخل **Authorized Domains**.
2. انشر القواعد والفهارس:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
3. بعد الدخول بحساب المدير العام، افتح **الإعدادات العامة** لتشغيل:
   - **تهيئة الإعدادات والأقسام الناقصة** (إن كانت القاعدة جديدة).
   - **ترحيل خرائط الأسعار والطوابير** لتحديث `menuPriceMap` للمطاعم القديمة وتهيئة `clinic_queues` للعيادات القديمة.
   - **إدارة المشرفين والشركاء** لربط كل شريك بمعرّف `UID` ونطاقه (`clinic` / `restaurant` / `captain`) والأنشطة المصرّح بها.

### 2. Cloudflare Pages
- **Build command**: `bun run build` (أو `npm run build`)
- **Build output directory**: `dist`
- ملف `public/_redirects` مضبوط بـ `/* /index.html 200` لضمان عمل الروابط العميقة وإعادة تحميل الصفحات بدون 404.
- دالة التحقق الخادمي `functions/api/orders/validate.ts` تُنشر تلقائياً مع Cloudflare Pages عند ضبط `FIREBASE_PROJECT_ID` و`FIRESTORE_DATABASE_ID` في إعدادات المشروع.

### 3. بذرة المشرف العام الأول (Bootstrapping the first admin)

لم يعد هناك بريد إلكتروني مدمج للمشرف العام. يُمنح دور `super_admin` فقط من خلال مستند أدوار (`admins/{uid}`)، لذا يجب بذرة المستند الأول خارج التطبيق (لأن القواعد لا تستطيع إنشاء مشرف عام دون وجوده أصلاً). بعد نشر القواعد، استخدم Firebase CLI (أو Firebase Console) بصلاحيات Admin SDK لإنشاء المستند الأول:

```bash
# 1. سجّل الدخول إلى حساب Google المراد تحويله إلى مشرف عام، وانسخ UID الخاص به
# 2. أنشئ مستند الأدوار مباشرةً (بصلاحية Admin — لا تخضع لقواعد Firestore):
firebase firestore:set admins/<UID> '{
  "uid": "<UID>",
  "email": "admin@example.com",
  "name": "المشرف العام",
  "role": "super_admin",
  "active": true
}' --database=ai-studio-bd327efc-a997-4475-a7c6-ee14154881c2
```

بعد البذرة، يظهر حساب Google هذا تلقائياً كمشرف عام عند الدخول. يمكن للمشرف العام بعدها إضافة المشرفين والشركاء الآخرين من لوحة الإدارة.

## ملاحظات أمنية إضافية

- **رفع الصور (Cloudinary):** يجب ضبط فلتر الرفع (`dalil_uploads`) ليسمح فقط بمجلد مخصص، مع حدود للحجم ونوع الملف (صور `webp`/`jpg`/`png`)، وأن يكون **موقّعاً (Signed)** أو أن تُعطَّل الفلتر غير الموقّع، مع تقييدات النطاق (HTTP referrer). لا تضع مفاتيح Cloudinary الحقيقية في المستودع.
- **دالة التحقق الخادمي:** تفشل بدلالة (`fail closed`) إذا غابت متغيرات Firebase، وتطبّق حداً أقصى لحجم الطلب (16 ك.ب) وتقييداً أساسياً للطلبات لكل IP.
- **روابط الصور:** يُقبل من المستخدمين فقط روابط `https://` صالحة أو مسارات نسبية للنطاق نفسه؛ تُرفض `javascript:` و`data:` والروابط غير الآمنة.
