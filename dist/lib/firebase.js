import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { existsSync } from "fs";
import { readFileSync } from "fs";
let firebaseApp = null;
let firestoreDb = null;
function buildServiceAccountFromEnv() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (clientEmail && privateKey && projectId) {
        return {
            type: "service_account",
            project_id: projectId,
            private_key: privateKey.replace(/\\n/g, "\n"),
            client_email: clientEmail,
        };
    }
    return null;
}
export function initFirebase() {
    try {
        const serviceAccount = buildServiceAccountFromEnv();
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (serviceAccount) {
            firebaseApp = initializeApp({
                credential: cert(serviceAccount),
            });
        }
        else if (serviceAccountPath && existsSync(serviceAccountPath)) {
            const raw = readFileSync(serviceAccountPath, "utf-8");
            firebaseApp = initializeApp({
                credential: cert(JSON.parse(raw)),
            });
        }
        else {
            console.warn("Firebase not configured - set FIREBASE_SERVICE_ACCOUNT, FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID, or GOOGLE_APPLICATION_CREDENTIALS");
            return false;
        }
        firestoreDb = getFirestore(firebaseApp);
        firestoreDb.collection("test").limit(1).get().then(() => {
            console.log("Firebase Firestore connected successfully");
        }).catch((e) => {
            console.warn("Firebase Firestore unavailable - using SQLite fallback:", e.message);
            firestoreDb = null;
        });
        return true;
    }
    catch (e) {
        console.warn("Firebase init skipped - using SQLite fallback:", e instanceof Error ? e.message : String(e));
        return false;
    }
}
export function getFirebase() {
    return firestoreDb;
}
export function isFirebaseAvailable() {
    return firestoreDb !== null;
}
export function sanitizeForFirestore(value) {
    if (Array.isArray(value)) {
        const cleaned = value.map((item) => sanitizeForFirestore(item)).filter((item) => item !== undefined);
        return cleaned;
    }
    if (value !== null && typeof value === "object") {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            if (val !== undefined) {
                result[key] = sanitizeForFirestore(val);
            }
        }
        return result;
    }
    return value;
}
export { FieldValue, Timestamp };
