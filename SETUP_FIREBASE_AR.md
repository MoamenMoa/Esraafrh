# ربط الموقع بـFirebase — خطوة بخطوة

## 1) إنشاء مشروع Firebase

1. افتح https://console.firebase.google.com/
2. اضغط **Create a project**.
3. سمِّ المشروع مثلًا `esraafrh-project-manager`.
4. Google Analytics غير مطلوب لتشغيل الموقع.

## 2) إضافة Web App

1. من صفحة المشروع اضغط رمز الويب `</>`.
2. اكتب اسمًا مثل `Esraafrh Web`.
3. اضغط **Register app**.
4. انسخ كائن `firebaseConfig` الذي سيظهر.

افتح ملف `firebase-config.js` واستبدل القيم التالية فقط:

```js
firebaseConfig: {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
}
```

لا تغيّر أسماء الحسابات الموجودة في نفس الملف إلا إذا كنت ستعدّل القواعد أيضًا.

## 3) تفعيل تسجيل الدخول

1. افتح **Authentication**.
2. اضغط **Get started**.
3. افتح **Sign-in method**.
4. فعّل **Email/Password**.

## 4) إنشاء المستخدمين

من **Authentication → Users → Add user** أنشئ:

- `esraafrh@example.com`
- `mohamed.elnshwi@example.com`
- `ahmed.nagib@example.com`

اختر كلمة مرور قوية لكل حساب. استخدم الإيميلات بالحروف الصغيرة كما هي.

لا تحتاج لإنشاء مستندات users يدويًا؛ الموقع ينشئ ملف المستخدم المصرح به تلقائيًا عند أول تسجيل دخول.

## 5) إنشاء Cloud Firestore

1. افتح **Firestore Database**.
2. اضغط **Create database**.
3. اختر **Production mode**.
4. اختر أقرب منطقة جغرافية مناسبة لك.

## 6) نشر قواعد الحماية

1. افتح ملف `firestore.rules` الموجود مع الموقع.
2. انسخ محتواه كاملًا.
3. في Firebase افتح **Firestore Database → Rules**.
4. احذف القواعد الموجودة والصق القواعد الجديدة.
5. اضغط **Publish**.

القواعد تجعل:

- كل مستخدم مسجل وفعال يرى كل المشاريع.
- المدير فقط ينشئ ويعدّل ويحذف المشاريع والبنود.
- أول مستخدم يستلم المشروع يتم تثبيت اسمه بمعاملة آمنة.
- المستخدم الذي بدأ المشروع والمدير يمكنهما إنهاء البنود والملاحظات وإضافة المصروفات.
- حساب غير موجود ضمن الإيميلات الثلاثة لا يستطيع إنشاء ملف مستخدم.

## 7) تعطيل فهرسة صورة الفاتورة — موصى به

صورة الفاتورة تحفظ كنص كبير داخل مجموعة `receipt`. لتعطيل فهرسة هذا الحقل:

### من Firebase CLI

بعد تثبيت Firebase CLI وتسجيل الدخول، من مجلد المشروع شغّل:

```bash
firebase deploy --only firestore:indexes
```

سيستخدم الملف `firestore.indexes.json`.

هذه الخطوة موصى بها لتقليل فهرسة بيانات الصور، لكن تشغيل الموقع الأساسي لا يتوقف عليها.

## 8) إضافة نطاق GitHub Pages

بعد نشر الموقع سيكون نطاقك مثل:

```text
moamenmoa.github.io
```

داخل Firebase افتح:

**Authentication → Settings → Authorized domains → Add domain**

وأضف نطاق GitHub فقط، بدون `https://` وبدون اسم المستودع.

## 9) أول تشغيل

1. افتح رابط الموقع.
2. ادخل بـ `Esraafrh` أو `esraafrh@example.com`.
3. في أول دخول يُنشئ الموقع ملف المدير.
4. إذا كانت قاعدة المشاريع فارغة، يُنشئ مشروع هليوبوليس وقائمة الـ26 بندًا تلقائيًا.
5. سجّل دخول المستخدمين مرة واحدة ليظهروا في قائمة فريق العمل وخانة تعيين المسؤول.

## أخطاء شائعة

### تظهر شاشة «اربط الموقع بـFirebase أولًا»
بيانات `firebase-config.js` ما زالت افتراضية أو ناقصة.

### Permission denied
قواعد `firestore.rules` لم تُنشر، أو البريد المستخدم ليس واحدًا من الإيميلات المسموحة.

### الحساب يدخل ثم يخرج مباشرة
تأكد من كتابة البريد داخل Firebase Authentication بالحروف الصغيرة وبنفس الإملاء.

### المشروع لا يظهر على جهاز آخر
تأكد أن الجهازين يستخدمان رابط GitHub Pages نفسه، وأن Firebase متصل، وليس ملف `index.html` مفتوحًا مباشرة من الكمبيوتر.

### صورة الفاتورة لا تُحفظ
استخدم JPG أو PNG أو WEBP. الحد الأقصى للصورة الأصلية 12 MB، ويُفضّل تصوير الفاتورة بوضوح ومن مسافة قريبة.
