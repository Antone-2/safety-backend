import { getDb, saveDb, allRows } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const now = () => new Date().toISOString();

export class BaseService {
  protected tableName: string;
  protected schema: z.ZodObject<any>;

  constructor(tableName: string, schema: z.ZodObject<any>) {
    this.tableName = tableName;
    this.schema = schema;
  }

  protected validate(data: any) {
    return this.schema.parse(data);
  }

  protected ensureColumn(db: any, table: string, column: string, definition: string) {
    const columns = db.exec(`PRAGMA table_info(${table})`);
    const exists = columns.some((col: any) => col.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  protected ensureTable(db: any, createSql: string) {
    db.run(createSql);
  }

  async getAll(filters?: Record<string, any>): Promise<any[]> {
    const db = await getDb();
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    const where: string[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          where.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    sql += ` ORDER BY createdAt DESC`;

    const rows = allRows(db, sql, params);
    await saveDb(db);
    return rows;
  }

  async getById(id: string): Promise<any | null> {
    const db = await getDb();
    const rows = allRows(db, `SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    await saveDb(db);
    return rows[0] || null;
  }

  async create(data: Record<string, any>): Promise<any> {
    const validated = this.validate(data);
    const db = await getDb();
    const id = validated.id || uuidv4();
    const record = { ...validated, id, createdAt: now(), updatedAt: now() };

    const keys = Object.keys(record);
    const placeholders = keys.map(() => "?").join(",");
    const sql = `INSERT INTO ${this.tableName} (${keys.join(",")}) VALUES (${placeholders})`;
    const values = keys.map((k) => record[k as keyof typeof record]);

    db.run(sql, values);
    await saveDb(db);
    return record;
  }

  async update(id: string, data: Record<string, any>): Promise<any> {
    const db = await getDb();
    const existing = await this.getById(id);
    if (!existing) throw new Error(`${this.tableName} not found`);

    const updated = { ...existing, ...data, updatedAt: now() };
    const keys = Object.keys(updated).filter((k) => k !== "id");
    const setClause = keys.map((k) => `${k} = ?`).join(",");
    const values = keys.map((k) => updated[k as keyof typeof updated]);

    db.run(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`, [...values, id]);
    await saveDb(db);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    await saveDb(db);
    return (result as any).changes > 0;
  }

  async count(filters?: Record<string, any>): Promise<number> {
    const db = await getDb();
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];
    const where: string[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          where.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    const rows = allRows(db, sql, params);
    await saveDb(db);
    return rows[0]?.count || 0;
  }
}
