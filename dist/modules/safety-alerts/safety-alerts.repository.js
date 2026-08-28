const now = () => new Date().toISOString();
function asAlert(row) {
    return {
        id: String(row.id),
        alertNo: String(row.alert_no),
        title: String(row.title),
        category: String(row.category),
        severity: String(row.severity),
        status: String(row.status),
        summary: String(row.summary),
        immediateActions: row.immediate_actions ? String(row.immediate_actions) : undefined,
        lessonsLearned: String(row.lessons_learned),
        sourceType: row.source_type ? String(row.source_type) : undefined,
        sourceRef: row.source_ref ? String(row.source_ref) : undefined,
        audience: row.audience ? String(row.audience) : undefined,
        sites: Array.isArray(row.sites) ? row.sites.map(String) : undefined,
        departments: Array.isArray(row.departments) ? row.departments.map(String) : undefined,
        effectiveFrom: String(row.effective_from),
        effectiveUntil: row.effective_until ? String(row.effective_until) : undefined,
        acknowledgementRequired: Boolean(row.acknowledgement_required),
        publishedBy: row.published_by ? String(row.published_by) : undefined,
        publishedAt: row.published_at ? String(row.published_at) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asAcknowledgement(row) {
    return {
        id: String(row.id),
        alertId: String(row.alert_id),
        userId: String(row.user_id),
        userName: String(row.user_name),
        userEmail: row.user_email ? String(row.user_email) : undefined,
        acknowledgedAt: String(row.acknowledged_at),
        comments: row.comments ? String(row.comments) : undefined,
    };
}
export class SafetyAlertsRepository {
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
                where.push(`${column} = $${idx}`);
                params.push(value);
                idx += 1;
            });
        }
        const result = await this.pool.query(`SELECT * FROM safety_alerts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY effective_from DESC, created_at DESC`, params);
        return result.rows.map((row) => asAlert(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM safety_alerts WHERE id = $1", [id]);
        return result.rows[0] ? asAlert(result.rows[0]) : null;
    }
    async create(data) {
        const alertNo = `ALT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const result = await this.pool.query(`INSERT INTO safety_alerts (
        id, alert_no, title, category, severity, status, summary, immediate_actions, lessons_learned,
        source_type, source_ref, audience, sites, departments, effective_from, effective_until,
        acknowledgement_required, published_by, published_at, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      ) RETURNING *`, [
            alertNo,
            data.title,
            data.category,
            data.severity,
            data.status,
            data.summary,
            data.immediateActions ?? null,
            data.lessonsLearned,
            data.sourceType ?? null,
            data.sourceRef ?? null,
            data.audience ?? null,
            data.sites ?? null,
            data.departments ?? null,
            data.effectiveFrom,
            data.effectiveUntil ?? null,
            data.acknowledgementRequired,
            data.publishedBy ?? null,
            data.publishedAt ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asAlert(result.rows[0]);
    }
    async update(id, data) {
        const updates = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            category: "category",
            severity: "severity",
            status: "status",
            summary: "summary",
            immediateActions: "immediate_actions",
            lessonsLearned: "lessons_learned",
            sourceType: "source_type",
            sourceRef: "source_ref",
            audience: "audience",
            sites: "sites",
            departments: "departments",
            effectiveFrom: "effective_from",
            effectiveUntil: "effective_until",
            acknowledgementRequired: "acknowledgement_required",
            publishedBy: "published_by",
            publishedAt: "published_at",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value === undefined || !map[key])
                return;
            updates.push(`${map[key]} = $${idx}`);
            params.push(value);
            idx += 1;
        });
        if (!updates.length)
            return this.findById(id);
        updates.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const result = await this.pool.query(`UPDATE safety_alerts SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`, params);
        return result.rows[0] ? asAlert(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM safety_alerts WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async acknowledge(alertId, input) {
        const result = await this.pool.query(`INSERT INTO safety_alert_acknowledgements (
        id, alert_id, user_id, user_name, user_email, acknowledged_at, comments
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (alert_id, user_id)
      DO UPDATE SET
        user_name = EXCLUDED.user_name,
        user_email = EXCLUDED.user_email,
        acknowledged_at = EXCLUDED.acknowledged_at,
        comments = EXCLUDED.comments
      RETURNING *`, [
            alertId,
            input.userId,
            input.userName,
            input.userEmail ?? null,
            now(),
            input.comments ?? null,
        ]);
        return asAcknowledgement(result.rows[0]);
    }
    async getAcknowledgements(alertId) {
        const result = await this.pool.query(`SELECT * FROM safety_alert_acknowledgements WHERE alert_id = $1 ORDER BY acknowledged_at DESC`, [alertId]);
        return result.rows.map((row) => asAcknowledgement(row));
    }
    async getPendingAcknowledgements(userId) {
        const result = await this.pool.query(`SELECT a.*
       FROM safety_alerts a
       LEFT JOIN safety_alert_acknowledgements ack
         ON ack.alert_id = a.id
        AND ack.user_id = $1
       WHERE a.status = 'Published'
         AND a.acknowledgement_required = TRUE
         AND ack.id IS NULL
       ORDER BY a.effective_from DESC, a.created_at DESC`, [userId]);
        return result.rows.map((row) => asAlert(row));
    }
    async getStats() {
        const [statusResult, overdueResult] = await Promise.all([
            this.pool.query(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'Draft')::int AS draft,
           COUNT(*) FILTER (WHERE status = 'Published')::int AS published,
           COUNT(*) FILTER (WHERE status = 'Archived')::int AS archived,
           COUNT(*) FILTER (WHERE acknowledgement_required = TRUE)::int AS acknowledgement_required
         FROM safety_alerts`),
            this.pool.query(`SELECT COUNT(*)::int AS overdue
         FROM safety_alerts a
         WHERE a.status = 'Published'
           AND a.acknowledgement_required = TRUE
           AND EXISTS (
             SELECT 1
             FROM users u
             WHERE u.active = 1
               AND NOT EXISTS (
                 SELECT 1
                 FROM safety_alert_acknowledgements ack
                 WHERE ack.alert_id = a.id
                   AND ack.user_id = u.id
               )
           )`),
        ]);
        return {
            total: Number(statusResult.rows[0]?.total ?? 0),
            draft: Number(statusResult.rows[0]?.draft ?? 0),
            published: Number(statusResult.rows[0]?.published ?? 0),
            archived: Number(statusResult.rows[0]?.archived ?? 0),
            acknowledgementRequired: Number(statusResult.rows[0]?.acknowledgement_required ?? 0),
            overdueAcknowledgements: Number(overdueResult.rows[0]?.overdue ?? 0),
        };
    }
}
