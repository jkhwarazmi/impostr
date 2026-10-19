import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

// Server-only. Initialised lazily so builds don't need the service account
function getAdminApp() {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Env vars store the key's newlines as literal \n
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getDatabase(getAdminApp());
export const adminAppCheck = () => getAppCheck(getAdminApp());
