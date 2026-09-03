import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
export function mapAssignment(row) {
    return {
        id: String(row.id), reportId: String(row.report_id), status: row.status,
        priority: row.priority,
        assigneeId: row.assignee_id ? String(row.assignee_id) : undefined,
        assigneeEmail: String(row.assignee_email), assigneeName: row.assignee_name ? String(row.assignee_name) : undefined,
        assignedById: row.assigned_by_id ? String(row.assigned_by_id) : undefined,
        assignedByEmail: String(row.assigned_by_email), assignedByName: row.assigned_by_name ? String(row.assigned_by_name) : undefined,
        site: row.site ? String(row.site) : undefined, department: row.department ? String(row.department) : undefined,
        assignmentReason: row.assignment_reason ? String(row.assignment_reason) : undefined,
        responseDueAt: row.response_due_at ? new Date(String(row.response_due_at)).toISOString() : undefined,
        dueAt: row.due_at ? new Date(String(row.due_at)).toISOString() : undefined,
        verificationDueAt: row.verification_due_at ? new Date(String(row.verification_due_at)).toISOString() : undefined,
        version: Number(row.version), createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
}
export class AssignmentsRepository {
    async transaction(work) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            const result = await work(client);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK").catch(() => { });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async findById(id, client = pgPool) {
        const result = await client.query("SELECT * FROM report_assignments WHERE id = $1", [id]);
        return result.rows[0] ? mapAssignment(result.rows[0]) : null;
    }
    async list(filters) {
        const values = [];
        const where = ["a.archived_at IS NULL"];
        const add = (sql, value) => { values.push(value); where.push(sql.replace("?", `$${values.length}`)); };
        if (filters.email) {
            values.push(filters.email);
            where.push(`(lower(a.assignee_email) = lower($${values.length}) OR EXISTS (SELECT 1 FROM assignment_participants p WHERE p.assignment_id=a.id AND lower(p.email)=lower($${values.length}) AND p.active=TRUE))`);
        }
        if (filters.reportId)
            add("a.report_id = ?", filters.reportId);
        if (filters.status)
            add("a.status = ?", filters.status);
        if (filters.site)
            add("lower(a.site) = lower(?)", filters.site);
        if (filters.department)
            add("lower(a.department) = lower(?)", filters.department);
        const result = await pgPool.query(`SELECT a.* FROM report_assignments a ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.updated_at DESC LIMIT 500`, values);
        return result.rows.map(mapAssignment);
    }
    async timeline(id) {
        const result = await pgPool.query("SELECT * FROM assignment_events WHERE assignment_id=$1 ORDER BY created_at ASC", [id]);
        return result.rows;
    }
}
export const assignmentsRepository = new AssignmentsRepository();
