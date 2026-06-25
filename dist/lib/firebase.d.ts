import { type Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
export declare function initFirebase(): boolean;
export declare function getFirebase(): Firestore | null;
export declare function isFirebaseAvailable(): boolean;
export { FieldValue, Timestamp };
