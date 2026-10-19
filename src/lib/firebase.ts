import { initializeApp, getApps } from "firebase/app";
import { getLimitedUseToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Reuse the existing app on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check only runs in the browser, and has to start before the database or auth are used
const appCheck = typeof window === "undefined" ? null : (() => {
  if (process.env.NODE_ENV === "development") {
    // Register this under App Check > Apps > Manage debug tokens. If it's unset, the SDK logs a new one to the console
    (window as Window & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN || true;
  }
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""),
    isTokenAutoRefreshEnabled: true,
  });
})();

// Single-use token for our own API routes, so a captured token can't be replayed
export async function getAppCheckToken() {
  if (!appCheck) throw new Error("App Check isn't available on the server");
  return (await getLimitedUseToken(appCheck)).token;
}

export const db = getDatabase(app);
export const auth = getAuth(app);
