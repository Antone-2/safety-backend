/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export declare function initFirebase(): false;
export declare function getFirebase(): any | null;
export declare function isFirebaseAvailable(): false;
export declare function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T;
