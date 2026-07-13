/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export declare function initFirebase(): void;
export declare function getFirestoreClient(): any | null;
export declare function getFirebase(): any | null;
export declare function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T;
export declare function isFirebaseAvailable(): false;
