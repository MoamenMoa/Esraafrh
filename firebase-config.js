/**
 * هنا يتم وضع بيانات Firebase Web قبل تشغيل الموقع.
 * Authentication وFirestore لا يعتمدان على كلمة مرور داخل هذا الملف،
 * بل يعتمدان على firebaseConfig وقواعد الحماية.
 */

export const APP_CONFIG = {
  appName: "إشراف لإدارة المشاريع",
  companyName: "Esraafrh",
  currency: "EGP",
  firebaseSdkVersion: "12.16.0",

  accounts: {
    esraafrh: {
      email: "esraafrh@example.com",
      name: "Esraafrh",
      role: "admin"
    },

    "mohamed elnshwi": {
      email: "mohamed.elnshwi@example.com",
      name: "Mohamed Elnshwi",
      role: "user"
    },

    mohamedelnshwi: {
      email: "mohamed.elnshwi@example.com",
      name: "Mohamed Elnshwi",
      role: "user"
    },

    ahmednagib: {
      email: "ahmed.nagib@example.com",
      name: "AhmedNagib",
      role: "user"
    },

    "ahmed nagib": {
      email: "ahmed.nagib@example.com",
      name: "AhmedNagib",
      role: "user"
    }
  },

  firebaseConfig: {
    apiKey: "AIzaSyCBwka63YjKS1Kn4B1AuiUOTe7HuD9H52s",
    authDomain: "esraafrh-tasks.firebaseapp.com",
    projectId: "esraafrh-tasks",
    storageBucket: "esraafrh-tasks.firebasestorage.app",
    messagingSenderId: "1005483284045",
    appId: "1:1005483284045:web:43530cb61cc2f48567ae04"
  }
};

export function isFirebaseConfigured() {
  const config = APP_CONFIG.firebaseConfig;

  return Boolean(
    config.apiKey &&
      !config.apiKey.includes("PASTE_") &&
      config.projectId &&
      !config.projectId.includes("YOUR_") &&
      config.appId &&
      !config.appId.includes("YOUR_")
  );
}
