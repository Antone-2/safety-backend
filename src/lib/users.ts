import { allRows, getDb } from "./database.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

function isPgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

function mapPgUser(row: any): AppUser {
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

export async function listUsers(roleFilter?: string[]): Promise<AppUser[]> {
  if (isPgConfigured()) {
    try {
      if (roleFilter && roleFilter.length) {
        const result = await pgPool.query(
          `SELECT id::text, name, email, phone, role
           FROM users
           WHERE role = ANY($1::text[])
           ORDER BY name`,
          [roleFilter],
        );
        return result.rows.map(mapPgUser);
      }
      const result = await pgPool.query(
        `SELECT id::text, name, email, phone, role
         FROM users
         ORDER BY name`,
      );
      return result.rows.map(mapPgUser);
    } catch {
      // The retired compatibility path below fails closed; it cannot open SQLite.
    }
  }

  const db = await getDb();
  if (roleFilter && roleFilter.length) {
    const placeholders = roleFilter.map(() => "?").join(",");
    const rows = allRows(
      db,
      `SELECT id, name, email, phone, role FROM users WHERE role IN (${placeholders})`,
      roleFilter,
    ) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone || undefined,
      role: r.role,
    }));
  }

  const rows = allRows(db, "SELECT id, name, email, phone, role FROM users") as any[];
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone || undefined,
    role: r.role,
  }));
}

export async function findUserByIdentifier(identifier: string): Promise<AppUser | null> {
  if (!identifier) return null;

  const db = await getDb();
  const row = (
    allRows(db, "SELECT id, name, email, phone, role FROM users WHERE email = ? OR id = ? LIMIT 1", [
      identifier,
      identifier,
    ])[0] as any
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role,
  };
}
