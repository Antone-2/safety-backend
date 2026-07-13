/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export function initFirebase() {
    return false;
}
export function getFirebase() {
    return null;
}
export function isFirebaseAvailable() {
    return false;
}
export function sanitizeForFirestore(data) {
    return data;
}
