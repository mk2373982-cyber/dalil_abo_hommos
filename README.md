# دليل أبوحمص (Dalil Abo Hommos)

منصة مجتمعية رقمية شاملة لمركز ومدينة أبوحمص (البحيرة): دليل العيادات وحجز الأدوار الحي، المطاعم والطلب أونلاين، الدليفري الموحد، الطوارئ، العقارات، المكافحون، والتخفيضات، مع لوحة إدارة مركزية ولوحات تشغيل معزولة للشركاء (عيادات، مطاعم، كباتن).

## المتطلبات والتشغيل المحلي

- **Node.js 22+** أو **Bun 1.4+**
- **Firebase CLI** لنشر القواعد والفهارس (`npm i -g firebase-tools`)
- **Java 11+** فقط عند تشغيل اختبارات محاكي قواعد Firestore محلياً

```bash
bun install
bun run dev
```

## متغيرات البيئة

راجع ملف `.env.example` (لا تضع أي مفاتيح سرية داخل المستودع):
- متغيرات الواجهة تبدأ بـ `VITE_*` (مثل إعدادات Firebase و `VITE_GOOGLE_MAPS_API_KEY` إن لزم).
- متغيرات دالة Cloudflare Pages (`/functions/api/orders/validate.ts`):
  - `FIREBASE_PROJECT_ID`
  - `FIRESTORE_DATABASE_ID` (اختياري، الافتراضي `(default)`)

## الأوامر والفحوص

```bash
bun run typecheck   # فحص TypeScript (tsc --noEmit)
bun run lint:rules  # فحص قواعد firestore.rules عبر @firebase/eslint-plugin-security-rules
bun run test        # تشغيل اختبارات الوحدة (bun test)
bun run build       # بناء نسخة الإنتاج (dist/)
```

### تشغيل اختبارات محاكي قواعد Firestore (يتطلب Java 11+)

```bash
firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"
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
