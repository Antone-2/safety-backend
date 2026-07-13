/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export function initFirebase() {
    throw new Error("Firebase is disabled; use PostgreSQL repositories");
}
export function getFirestoreClient() {
    return null;
}
export function getFirebase() {
    return null;
}
export function sanitizeForFirestore(data) {
    return data;
}
export function isFirebaseAvailable() {
    return false;
}
