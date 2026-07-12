import { type Firestore } from "firebase/firestore";
export declare function initFirebase(): void;
export declare function getFirestoreClient(): Firestore | null;
export declare function getFirebase(): Firestore | null;
export declare function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T;
export declare function isFirebaseAvailable(): boolean;
