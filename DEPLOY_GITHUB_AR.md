# رفع النسخة الكاملة على GitHub Pages

## 1) فك الضغط

فك ضغط الحزمة وافتح المجلد. ارفع **محتويات المجلد** وليس ملف ZIP نفسه.

يجب أن يظهر `index.html` مباشرة في الصفحة الرئيسية للمستودع.

## 2) رفع الملفات

داخل مستودع GitHub:

1. افتح تبويب **Code**.
2. اضغط **Add file → Upload files**.
3. اسحب كل الملفات والمجلدات الموجودة داخل الحزمة.
4. اكتب رسالة Commit مثل:

```text
Upload production project management website
```

5. اضغط **Commit changes**.

## 3) تشغيل GitHub Pages

1. افتح **Settings → Pages**.
2. عند **Source** اختر **Deploy from a branch**.
3. اختر:
   - Branch: `main`
   - Folder: `/(root)`
4. اضغط **Save**.

إذا كان اسم المستودع `Esraafrh` وحسابك `MoamenMoa`، سيكون الرابط غالبًا:

```text
https://moamenmoa.github.io/Esraafrh/
```

## 4) تحديث الموقع بعد أي تعديل

ارفع الملفات الجديدة بنفس الأسماء ثم اضغط Commit. GitHub يستبدل النسخة القديمة تلقائيًا.

بعد النشر:

- على الكمبيوتر: `Ctrl + F5`
- على الموبايل: افتح الرابط في نافذة خاصة أو امسح بيانات الموقع إذا ظهرت نسخة قديمة.

## 5) ترتيب الملفات الصحيح

صحيح:

```text
Esraafrh/index.html
Esraafrh/app.js
Esraafrh/styles.css
```

خطأ:

```text
Esraafrh/esraafrh-production/index.html
```

## 6) لا ترفع كلمات المرور

كلمات المرور تبقى داخل Firebase Authentication فقط. ملف `firebase-config.js` يحتوي إعداد تطبيق الويب وليس كلمات مرور المستخدمين.
