const now = () => new Date().toISOString();
function asObservation(row) {
    return {
        id: String(row.id),
        title: String(row.title),
        type: String(row.type),
        category: String(row.category),
        behavior: String(row.behavior),
        location: String(row.location),
        site: String(row.site),
        department: String(row.department),
        observerName: String(row.observer_name),
        observerDepartment: row.observer_department ? String(row.observer_department) : undefined,
        observedPerson: row.observed_person ? String(row.observed_person) : undefined,
        observedTeam: row.observed_team ? String(row.observed_team) : undefined,
        shift: row.shift ? String(row.shift) : undefined,
        observationDate: String(row.observation_date),
        severity: String(row.severity),
        status: String(row.status),
        immediateAction: row.immediate_action ? String(row.immediate_action) : undefined,
        coachingNote: row.coaching_note ? String(row.coaching_note) : undefined,
        assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
        dueDate: row.due_date ? String(row.due_date) : undefined,
        followUpRequired: Boolean(row.follow_up_required),
        verificationNote: row.verification_note ? String(row.verification_note) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class ObservationsRepository {
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
                if (value === undefined || value === null || value === "")
                    return;
                const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                if (key === "title" ||
                    key === "category" ||
                    key === "site" ||
                    key === "department" ||
                    key === "observerName" ||
                    key === "assignedTo") {
                    where.push(`${column} ILIKE $${idx}`);
                    params.push(`%${value}%`);
                }
                else {
                    where.push(`${column} = $${idx}`);
                    params.push(value);
                }
                idx++;
            });
        }
        const result = await this.pool.query(`SELECT * FROM safety_observations ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY observation_date DESC, created_at DESC`, params);
        return result.rows.map((row) => asObservation(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM safety_observations WHERE id = $1", [id]);
        return result.rows[0]
            ? asObservation(result.rows[0])
            : null;
    }
    async create(data) {
        const result = await this.pool.query(`INSERT INTO safety_observations (
        id, title, type, category, behavior, location, site, department, observer_name,
        observer_department, observed_person, observed_team, shift, observation_date, severity,
        status, immediate_action, coaching_note, assigned_to, due_date, follow_up_required,
        verification_note, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      ) RETURNING *`, [
            data.title,
            data.type,
            data.category,
            data.behavior,
            data.location,
            data.site,
            data.department,
            data.observerName,
            data.observerDepartment ?? null,
            data.observedPerson ?? null,
            data.observedTeam ?? null,
            data.shift ?? null,
            data.observationDate,
            data.severity,
            data.status,
            data.immediateAction ?? null,
            data.coachingNote ?? null,
            data.assignedTo ?? null,
            data.dueDate ?? null,
            data.followUpRequired,
            data.verificationNote ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asObservation(result.rows[0]);
    }
    async update(id, data) {
        const updates = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            type: "type",
            category: "category",
            behavior: "behavior",
            location: "location",
            site: "site",
            department: "department",
            observerName: "observer_name",
            observerDepartment: "observer_department",
            observedPerson: "observed_person",
            observedTeam: "observed_team",
            shift: "shift",
            observationDate: "observation_date",
            severity: "severity",
            status: "status",
            immediateAction: "immediate_action",
            coachingNote: "coaching_note",
            assignedTo: "assigned_to",
            dueDate: "due_date",
            followUpRequired: "follow_up_required",
            verificationNote: "verification_note",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value === undefined || !map[key])
                return;
            updates.push(`${map[key]} = $${idx}`);
            params.push(value);
            idx++;
        });
        if (!updates.length)
            return this.findById(id);
        updates.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const result = await this.pool.query(`UPDATE safety_observations SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`, params);
        return result.rows[0]
            ? asObservation(result.rows[0])
            : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM safety_observations WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async getStats() {
        const [typesResult, statusResult, followUpResult] = await Promise.all([
            this.pool.query(`SELECT type, COUNT(*)::int AS count FROM safety_observations GROUP BY type`),
            this.pool.query(`SELECT status, COUNT(*)::int AS count FROM safety_observations GROUP BY status`),
            this.pool.query(`SELECT COUNT(*)::int AS count FROM safety_observations WHERE follow_up_required = TRUE`),
        ]);
        const byType = new Map();
        const byStatus = new Map();
        typesResult.rows.forEach((row) => byType.set(String(row.type), Number(row.count)));
        statusResult.rows.forEach((row) => byStatus.set(String(row.status), Number(row.count)));
        return {
            total: (byType.get("Positive") ?? 0) +
                (byType.get("At Risk") ?? 0) +
                (byType.get("Improvement") ?? 0),
            positive: byType.get("Positive") ?? 0,
            atRisk: byType.get("At Risk") ?? 0,
            improvement: byType.get("Improvement") ?? 0,
            open: byStatus.get("Open") ?? 0,
            coachingLogged: byStatus.get("Coaching Logged") ?? 0,
            closed: byStatus.get("Closed") ?? 0,
            followUpRequired: Number(followUpResult.rows[0]?.count ?? 0),
        };
    }
}
