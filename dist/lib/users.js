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
export async function listUsers(roleFilter) {
    if (isPgConfigured()) {
        try {
            if (roleFilter && roleFilter.length) {
                const result = await pgPool.query(`SELECT id::text, name, email, phone, role
           FROM users
           WHERE active = TRUE AND role = ANY($1::text[])
           ORDER BY name`, [roleFilter]);
                return result.rows.map(mapPgUser);
            }
            const result = await pgPool.query(`SELECT id::text, name, email, phone, role
         FROM users
         WHERE active = TRUE
         ORDER BY name`);
            return result.rows.map(mapPgUser);
        }
        catch {
            // The retired compatibility path below fails closed; it cannot open SQLite.
        }
    }
    const db = await getDb();
    if (roleFilter && roleFilter.length) {
        const placeholders = roleFilter.map(() => "?").join(",");
        const rows = allRows(db, `SELECT id, name, email, phone, role FROM users WHERE active = 1 AND role IN (${placeholders})`, roleFilter);
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || undefined,
            role: r.role,
        }));
    }
    const rows = allRows(db, "SELECT id, name, email, phone, role FROM users WHERE active = 1");
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
    if (isPgConfigured()) {
        const result = await pgPool.query(`SELECT id::text, name, email, phone, role FROM users
       WHERE (lower(email) = lower($1) OR id::text = $1) AND active = TRUE LIMIT 1`, [identifier]);
        return result.rows[0] ? mapPgUser(result.rows[0]) : null;
    }
    const db = await getDb();
    const row = allRows(db, "SELECT id, name, email, phone, role FROM users WHERE (lower(email) = lower(?) OR id = ?) AND active = 1 LIMIT 1", [
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
