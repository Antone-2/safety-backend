const now = () => new Date().toISOString();
function asHeightWork(row) {
    return {
        id: String(row.id),
        permitNo: row.permit_no ? String(row.permit_no) : undefined,
        location: String(row.location),
        building: String(row.building),
        floor: row.floor ? String(row.floor) : undefined,
        taskDescription: String(row.task_description),
        height: Number(row.height),
        fallProtection: row.fall_protection ? String(row.fall_protection) : undefined,
        rescuePlan: row.rescue_plan ? String(row.rescue_plan) : undefined,
        harnessInspectionDate: row.harness_inspection_date ? String(row.harness_inspection_date) : undefined,
        anchorPointInspected: Boolean(row.anchor_point_inspected),
        workersCount: Number(row.workers_count),
        workers: row.workers ? String(row.workers) : undefined,
        supervisor: String(row.supervisor),
        startDate: String(row.start_date),
        endDate: String(row.end_date),
        status: String(row.status),
        incidentReport: row.incident_report ? String(row.incident_report) : undefined,
        photos: Array.isArray(row.photos) ? row.photos.map((p) => String(p)) : [],
        notes: row.notes ? String(row.notes) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class HeightWorkRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async findAll(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                    if (key === "location" || key === "building") {
                        where.push(`${pgKey} ILIKE $${idx}`);
                        params.push(`%${value}%`);
                    }
                    else {
                        where.push(`${pgKey} = $${idx}`);
                        params.push(value);
                    }
                    idx++;
                }
            });
        }
        const sql = `SELECT * FROM height_works ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asHeightWork(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM height_works WHERE id = $1", [id]);
        return result.rows[0] ? asHeightWork(result.rows[0]) : null;
    }
    async create(data) {
        const permitNo = `HGT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        const result = await this.pool.query(`INSERT INTO height_works (id, permit_no, location, building, floor, task_description, height, fall_protection, rescue_plan, harness_inspection_date, anchor_point_inspected, workers_count, workers, supervisor, start_date, end_date, status, incident_report, photos, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22)
       RETURNING *`, [
            permitNo,
            data.location,
            data.building,
            data.floor ?? null,
            data.taskDescription,
            data.height,
            data.fallProtection ?? null,
            data.rescuePlan ?? null,
            data.harnessInspectionDate ?? null,
            data.anchorPointInspected ?? false,
            data.workersCount,
            data.workers ?? null,
            data.supervisor,
            data.startDate,
            data.endDate,
            data.status ?? "Planned",
            data.incidentReport ?? null,
            JSON.stringify(data.photos ?? []),
            data.notes ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asHeightWork(result.rows[0]);
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            location: "location",
            building: "building",
            floor: "floor",
            taskDescription: "task_description",
            height: "height",
            fallProtection: "fall_protection",
            rescuePlan: "rescue_plan",
            harnessInspectionDate: "harness_inspection_date",
            anchorPointInspected: "anchor_point_inspected",
            workersCount: "workers_count",
            workers: "workers",
            supervisor: "supervisor",
            startDate: "start_date",
            endDate: "end_date",
            status: "status",
            incidentReport: "incident_report",
            photos: "photos",
            notes: "notes",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                if (key === "photos") {
                    fields.push(`${map[key]} = $${idx}::jsonb`);
                    params.push(JSON.stringify(value));
                }
                else {
                    fields.push(`${map[key]} = $${idx}`);
                    params.push(value);
                }
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findById(id);
        fields.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const sql = `UPDATE height_works SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
        const result = await this.pool.query(sql, params);
        return result.rows[0] ? asHeightWork(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM height_works WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async getStats() {
        const result = await this.pool.query("SELECT status, COUNT(*) as count FROM height_works GROUP BY status");
        const stats = {};
        result.rows.forEach((row) => {
            stats[String(row.status)] = parseInt(row.count, 10);
        });
        return {
            total: Object.values(stats).reduce((sum, count) => sum + count, 0),
            inProgress: stats["In Progress"] || 0,
            completed: stats["Completed"] || 0,
            planned: stats["Planned"] || 0,
        };
    }
}
