import { getDb, saveDb, allRows } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
const now = () => new Date().toISOString();
export class BaseService {
    tableName;
    schema;
    constructor(tableName, schema) {
        this.tableName = tableName;
        this.schema = schema;
    }
    validate(data) {
        return this.schema.parse(data);
    }
    ensureColumn(db, table, column, definition) {
        const columns = db.exec(`PRAGMA table_info(${table})`);
        const exists = columns.some((col) => col.name === column);
        if (!exists) {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
    }
    ensureTable(db, createSql) {
        db.run(createSql);
    }
    async getAll(filters) {
        const db = await getDb();
        let sql = `SELECT * FROM ${this.tableName}`;
        const params = [];
        const where = [];
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
    async getById(id) {
        const db = await getDb();
        const rows = allRows(db, `SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
        await saveDb(db);
        return rows[0] || null;
    }
    async create(data) {
        const validated = this.validate(data);
        const db = await getDb();
        const id = validated.id || uuidv4();
        const record = { ...validated, id, createdAt: now(), updatedAt: now() };
        const keys = Object.keys(record);
        const placeholders = keys.map(() => "?").join(",");
        const sql = `INSERT INTO ${this.tableName} (${keys.join(",")}) VALUES (${placeholders})`;
        const values = keys.map((k) => record[k]);
        db.run(sql, values);
        await saveDb(db);
        return record;
    }
    async update(id, data) {
        const db = await getDb();
        const existing = await this.getById(id);
        if (!existing)
            throw new Error(`${this.tableName} not found`);
        const updated = { ...existing, ...data, updatedAt: now() };
        const keys = Object.keys(updated).filter((k) => k !== "id");
        const setClause = keys.map((k) => `${k} = ?`).join(",");
        const values = keys.map((k) => updated[k]);
        db.run(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`, [...values, id]);
        await saveDb(db);
        return updated;
    }
    async delete(id) {
        const db = await getDb();
        const result = db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
        await saveDb(db);
        return result.changes > 0;
    }
    async count(filters) {
        const db = await getDb();
        let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params = [];
        const where = [];
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
