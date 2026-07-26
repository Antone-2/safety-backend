import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
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
    buildFilters(filters) {
        const where = [];
        const params = [];
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    where.push(`${key} = $${params.length + 1}`);
                    params.push(value);
                }
            });
        }
        return { where, params };
    }
    async getAll(filters) {
        const { where, params } = this.buildFilters(filters);
        const sql = `SELECT * FROM ${this.tableName}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC`;
        const result = await pgPool.query(sql, params);
        return result.rows;
    }
    async getById(id) {
        const result = await pgPool.query(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    async create(data) {
        const validated = this.validate(data);
        const id = validated.id || uuidv4();
        const record = { ...validated, id, createdAt: now(), updatedAt: now() };
        const keys = Object.keys(record);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(",");
        const sql = `INSERT INTO ${this.tableName} (${keys.join(",")}) VALUES (${placeholders})`;
        const values = keys.map((key) => record[key]);
        await pgPool.query(sql, values);
        return record;
    }
    async update(id, data) {
        const existing = await this.getById(id);
        if (!existing)
            throw new Error(`${this.tableName} not found`);
        const updated = { ...existing, ...data, updatedAt: now() };
        const keys = Object.keys(updated).filter((key) => key !== "id");
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
        const values = keys.map((key) => updated[key]);
        await pgPool.query(`UPDATE ${this.tableName} SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
        return updated;
    }
    async delete(id) {
        const result = await pgPool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async count(filters) {
        const { where, params } = this.buildFilters(filters);
        const sql = `SELECT COUNT(*) AS count FROM ${this.tableName}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
        const result = await pgPool.query(sql, params);
        return Number(result.rows[0]?.count ?? 0);
    }
}
