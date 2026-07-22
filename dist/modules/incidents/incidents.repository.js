export class IncidentsRepository {
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
                    if (key === "location" || key === "department" || key === "reporter" || key === "assignedTo") {
                        where.push(`${key} ILIKE $${idx}`);
                        params.push(`%${value}%`);
                    }
                    else {
                        where.push(`${key} = $${idx}`);
                        params.push(value);
                    }
                    idx++;
                }
            });
        }
        const sql = `SELECT * FROM incidents ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows;
    }
    async findAllReports() {
        const result = await this.pool.query(`SELECT id, type, severity, status, location, department, shift, description, reporter, anonymous, is_near_miss, photo_url, assigned_to, assigned_to_copy, sla_hours, due_at, resolution_days, compliance_required, compliance_due_at, source, created_at, updated_at FROM reports ORDER BY created_at DESC`);
        return result.rows;
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
        return result.rows[0] || null;
    }
    async create(data) {
        const now = new Date().toISOString();
        const result = await this.pool.query(`INSERT INTO incidents (id, type, severity, status, location, department, shift, description, reporter, reporter_email, reporter_phone, anonymous, is_near_miss, photo_url, photos, assigned_to, assigned_to_copy, sla_hours, due_at, resolution_days, root_cause, corrective_action, preventive_action, investigation_method, witness_statement, regulatory_notification_required, regulatory_notification_date, compliance_required, compliance_due_at, source, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
       RETURNING *`, [
            data.type,
            data.severity,
            data.status ?? "Open",
            data.location,
            data.department,
            data.shift,
            data.description,
            data.reporter,
            data.reporterEmail ?? null,
            data.reporterPhone ?? null,
            data.anonymous ? 1 : 0,
            data.isNearMiss ? 1 : 0,
            data.photoUrl ?? null,
            JSON.stringify(data.photos ?? []),
            data.assignedTo ?? null,
            JSON.stringify(data.assignedToCopy ?? []),
            data.slaHours ?? 24,
            data.dueAt ?? null,
            data.resolutionDays ?? null,
            data.rootCause ?? null,
            data.correctiveAction ?? null,
            data.preventiveAction ?? null,
            data.investigationMethod ?? null,
            data.witnessStatement ?? null,
            data.regulatoryNotificationRequired ? 1 : 0,
            data.regulatoryNotificationDate ?? null,
            data.complianceRequired ? 1 : 0,
            data.complianceDueAt ?? null,
            data.source ?? "manual",
            now,
            now,
        ]);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            type: "type",
            severity: "severity",
            status: "status",
            location: "location",
            department: "department",
            shift: "shift",
            description: "description",
            reporter: "reporter",
            reporterEmail: "reporter_email",
            reporterPhone: "reporter_phone",
            anonymous: "anonymous",
            isNearMiss: "is_near_miss",
            photoUrl: "photo_url",
            photos: "photos",
            assignedTo: "assigned_to",
            assignedToCopy: "assigned_to_copy",
            slaHours: "sla_hours",
            dueAt: "due_at",
            resolutionDays: "resolution_days",
            rootCause: "root_cause",
            correctiveAction: "corrective_action",
            preventiveAction: "preventive_action",
            investigationMethod: "investigation_method",
            witnessStatement: "witness_statement",
            regulatoryNotificationRequired: "regulatory_notification_required",
            regulatoryNotificationDate: "regulatory_notification_date",
            complianceRequired: "compliance_required",
            complianceDueAt: "compliance_due_at",
            source: "source",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                if (key === "photos" || key === "assignedToCopy") {
                    fields.push(`${map[key]} = $${idx}::jsonb`);
                    params.push(JSON.stringify(value));
                }
                else if (key === "anonymous" || key === "isNearMiss" || key === "regulatoryNotificationRequired" || key === "complianceRequired") {
                    fields.push(`${map[key]} = $${idx}`);
                    params.push(value ? 1 : 0);
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
        params.push(new Date().toISOString());
        params.push(id);
        const sql = `UPDATE incidents SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
        const result = await this.pool.query(sql, params);
        return result.rows[0] || null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM incidents WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async count(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    where.push(`${key} = $${idx}`);
                    params.push(value);
                    idx++;
                }
            });
        }
        const sql = `SELECT COUNT(*) as count FROM incidents ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}`;
        const result = await this.pool.query(sql, params);
        return parseInt(result.rows[0]?.count ?? "0", 10);
    }
}
