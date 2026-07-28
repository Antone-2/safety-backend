import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";
export const SpillSeveritySchema = z.enum(["Minor", "Major", "Critical"]);
export const SpillSchema = z.object({
    id: z.string().optional(),
    spillNo: z.string().optional(),
    chemical: z.string().min(1).max(200),
    casNumber: z.string().max(50).optional(),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(50),
    location: z.string().min(1).max(200),
    date: z.string().min(1),
    time: z.string().min(1),
    severity: SpillSeveritySchema,
    affectedArea: z.string().max(2000).optional(),
    responseActions: z.string().max(5000).optional(),
    cleanupCompleted: z.boolean().default(false),
    cleanupDate: z.string().optional(),
    reportedToNema: z.boolean().default(false),
    nemaReportDate: z.string().optional(),
    photoUrl: z.string().optional(),
    reportedBy: z.string().min(1).max(200),
    createdBy: z.string().min(1).max(200),
});
const now = () => new Date().toISOString();
function mapRow(row) {
    return {
        id: String(row.id),
        spillNo: row.spill_no ? String(row.spill_no) : undefined,
        chemical: String(row.chemical ?? ""),
        casNumber: row.cas_number ? String(row.cas_number) : undefined,
        quantity: Number(row.quantity ?? 0),
        unit: String(row.unit ?? ""),
        location: String(row.location ?? ""),
        date: row.date ? new Date(String(row.date)).toISOString() : "",
        time: String(row.time ?? ""),
        severity: String(row.severity ?? "Minor"),
        affectedArea: row.affected_area ? String(row.affected_area) : undefined,
        responseActions: row.response_actions ? String(row.response_actions) : undefined,
        cleanupCompleted: Boolean(row.cleanup_completed),
        cleanupDate: row.cleanup_date ? new Date(String(row.cleanup_date)).toISOString() : undefined,
        reportedToNema: Boolean(row.reported_to_nema),
        nemaReportDate: row.nema_report_date ? new Date(String(row.nema_report_date)).toISOString() : undefined,
        photoUrl: row.photo_url ? String(row.photo_url) : undefined,
        reportedBy: row.reported_by ? String(row.reported_by) : "",
        createdBy: String(row.created_by ?? "System"),
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
        updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
    };
}
export class SpillService {
    async getAll(filters) {
        const where = [];
        const params = [];
        const columns = {
            severity: "severity",
            location: "location",
            chemical: "chemical",
            reportedBy: "reported_by",
        };
        Object.entries(filters ?? {}).forEach(([key, value]) => {
            const column = columns[key];
            if (!column || value === undefined || value === null || value === "")
                return;
            params.push(value);
            where.push(`${column} = $${params.length}`);
        });
        const sql = `SELECT * FROM spills${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
        const result = await pgPool.query(sql, params);
        return result.rows.map((row) => mapRow(row));
    }
    async getById(id) {
        const result = await pgPool.query("SELECT * FROM spills WHERE id = $1", [id]);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async createSpill(data) {
        const validated = SpillSchema.parse({
            ...data,
            spillNo: data.spillNo ?? `SPILL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        });
        const id = validated.id || uuidv4();
        const timestamp = now();
        const result = await pgPool.query(`INSERT INTO spills (
        id, spill_no, chemical, cas_number, quantity, unit, location, date, time, severity,
        affected_area, response_actions, cleanup_completed, cleanup_date, reported_to_nema,
        nema_report_date, photo_url, reported_by, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      ) RETURNING *`, [
            id,
            validated.spillNo ?? null,
            validated.chemical,
            validated.casNumber ?? null,
            validated.quantity,
            validated.unit,
            validated.location,
            validated.date,
            validated.time,
            validated.severity,
            validated.affectedArea ?? null,
            validated.responseActions ?? null,
            validated.cleanupCompleted,
            validated.cleanupDate ?? null,
            validated.reportedToNema,
            validated.nemaReportDate ?? null,
            validated.photoUrl ?? null,
            validated.reportedBy,
            validated.createdBy,
            timestamp,
            timestamp,
        ]);
        return mapRow(result.rows[0]);
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        const map = {
            spillNo: "spill_no",
            chemical: "chemical",
            casNumber: "cas_number",
            quantity: "quantity",
            unit: "unit",
            location: "location",
            date: "date",
            time: "time",
            severity: "severity",
            affectedArea: "affected_area",
            responseActions: "response_actions",
            cleanupCompleted: "cleanup_completed",
            cleanupDate: "cleanup_date",
            reportedToNema: "reported_to_nema",
            nemaReportDate: "nema_report_date",
            photoUrl: "photo_url",
            reportedBy: "reported_by",
            createdBy: "created_by",
        };
        Object.entries(data).forEach(([key, value]) => {
            const column = map[key];
            if (!column || value === undefined)
                return;
            params.push(value);
            fields.push(`${column} = $${params.length}`);
        });
        if (fields.length === 0)
            return this.getById(id);
        params.push(now());
        fields.push(`updated_at = $${params.length}`);
        params.push(id);
        const result = await pgPool.query(`UPDATE spills SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await pgPool.query("DELETE FROM spills WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async getSpills(filters) {
        return this.getAll(filters);
    }
    async getSpillById(id) {
        return this.getById(id);
    }
    async getStats() {
        const result = await pgPool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE severity = 'Minor') AS minor,
        COUNT(*) FILTER (WHERE severity = 'Major') AS major,
        COUNT(*) FILTER (WHERE severity = 'Critical') AS critical,
        COUNT(*) FILTER (WHERE reported_to_nema = TRUE) AS reported_to_nema
      FROM spills
    `);
        return {
            total: Number(result.rows[0]?.total ?? 0),
            minor: Number(result.rows[0]?.minor ?? 0),
            major: Number(result.rows[0]?.major ?? 0),
            critical: Number(result.rows[0]?.critical ?? 0),
            reportedToNema: Number(result.rows[0]?.reported_to_nema ?? 0),
        };
    }
}
