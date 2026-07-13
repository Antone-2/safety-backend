import { isFirebaseAvailable, getFirebase } from "./firebase.js";
import { allRows, getDb } from "./database.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
function isPgConfigured() {
    return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}
function mapPgUser(row) {
    return {
        id: String(row.id),
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        role: row.role,
    };
}
// Roles eligible to appear in the "assign supervisor" (To) dropdown.
export const SUPERVISOR_ROLES = [
    "super-admin",
    "EHS-manager",
    "depot-admin",
    "gm",
    "plant-manager",
    "factory-manager",
    "supervisor",
    "she-committee-member",
];
function mapFirestoreUser(doc) {
    const d = doc.data() || {};
    return {
        id: doc.id,
        name: d.name || d.email || doc.id,
        email: d.email || "",
        phone: d.phone || undefined,
        role: d.role || "depot-admin",
    };
}
export async function listUsers(roleFilter) {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        let snap;
        if (roleFilter && roleFilter.length) {
            try {
                snap = await db.collection("users").where("role", "in", roleFilter).get();
            }
            catch {
                snap = await db.collection("users").get();
            }
        }
        else {
            snap = await db.collection("users").get();
        }
        return snap.docs
            .map(mapFirestoreUser)
            .filter((u) => Boolean(u.email));
    }
    if (isPgConfigured()) {
        try {
            if (roleFilter && roleFilter.length) {
                const result = await pgPool.query(`SELECT id::text, name, email, phone, role
           FROM users
           WHERE role = ANY($1::text[])
           ORDER BY name`, [roleFilter]);
                return result.rows.map(mapPgUser);
            }
            const result = await pgPool.query(`SELECT id::text, name, email, phone, role
         FROM users
         ORDER BY name`);
            return result.rows.map(mapPgUser);
        }
        catch {
            // Fall through to the SQLite fallback if Postgres is unreachable.
        }
    }
    const db = await getDb();
    if (roleFilter && roleFilter.length) {
        const placeholders = roleFilter.map(() => "?").join(",");
        const rows = allRows(db, `SELECT id, name, email, phone, role FROM users WHERE role IN (${placeholders})`, roleFilter);
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || undefined,
            role: r.role,
        }));
    }
    const rows = allRows(db, "SELECT id, name, email, phone, role FROM users");
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone || undefined,
        role: r.role,
    }));
}
export async function findUserByIdentifier(identifier) {
    if (!identifier)
        return null;
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        if (identifier.includes("@")) {
            const byEmail = await db.collection("users").where("email", "==", identifier).limit(1).get();
            if (!byEmail.empty)
                return mapFirestoreUser(byEmail.docs[0]);
        }
        const byId = await db.collection("users").doc(identifier).get();
        if (byId.exists)
            return mapFirestoreUser(byId);
        return null;
    }
    const db = await getDb();
    const row = allRows(db, "SELECT id, name, email, phone, role FROM users WHERE email = ? OR id = ? LIMIT 1", [
        identifier,
        identifier,
    ])[0];
    if (!row)
        return null;
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        role: row.role,
    };
}
