import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

export function initFirebase(): void {
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase configuration missing. Firestore features disabled.");
    return;
  }

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApps()[0];
    }
    firestore = getFirestore(firebaseApp);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export function getFirestoreClient(): Firestore | null {
  return firestore;
}

export function getFirebase(): Firestore | null {
  return firestore;
}

export function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
  ) as T;
}

export function isFirebaseAvailable(): boolean {
  return firestore !== null;
}
