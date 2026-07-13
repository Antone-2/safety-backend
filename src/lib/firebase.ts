/** Firestore persistence has been retired; PostgreSQL is the sole runtime database. */
export function initFirebase(): false {
  return false;
}

export function getFirebase(): any | null {
  return null;
}

export function isFirebaseAvailable(): false {
  return false;
}

export function sanitizeForFirestore<T extends Record<string, unknown>>(data: T): T {
  return data;
}
