import { type Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
export declare function initFirebase(): boolean;
export declare function getFirebase(): Firestore | null;
export declare function isFirebaseAvailable(): boolean;
export declare function sanitizeForFirestore<T extends Record<string, unknown>>(value: T): T;
export { FieldValue, Timestamp };
