/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export function initFirebase(): void {
  throw new Error("Firebase is disabled; use PostgreSQL repositories");
}

export function getFirestoreClient(): any | null {
  return null;
}

export function getFirebase(): any | null {
  return null;
}

export function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T {
  return data;
}

export function isFirebaseAvailable(): false {
  return false;
}
