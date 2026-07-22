import { randomUUID } from "node:crypto";
import { sendTestEmail } from "../lib/email.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
function renderTemplate(template, payload) {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const value = key.split(".").reduce((current, part) => {
            if (!current || typeof current !== "object")
                return undefined;
            return current[part];
        }, payload);
        return value == null ? "" : String(value);
    });
}
function templateRow(row) {
    return row && {
        id: row.id,
        eventKey: row.event_key,
        channel: row.channel,
        subjectTemplate: row.subject_template,
        bodyTemplate: row.body_template,
        active: row.active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function jobRow(row) {
    return row && {
        id: row.id,
        eventKey: row.event_key,
        workflow: row.workflow,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        payload: row.payload ?? {},
        status: row.status,
        attempts: Number(row.attempts ?? 0),
        maxAttempts: Number(row.max_attempts ?? 3),
        nextAttemptAt: row.next_attempt_at,
        lastError: row.last_error,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function recipientRow(row) {
    return row && {
        id: row.id,
        jobId: row.job_id,
        channel: row.channel,
        recipient: row.recipient,
        recipientName: row.recipient_name,
        status: row.status,
        attempts: Number(row.attempts ?? 0),
        deliveredAt: row.delivered_at,
        failedAt: row.failed_at,
        lastError: row.last_error,
        providerMessageId: row.provider_message_id,
        readAt: row.read_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export class NotificationCenterService {
    async listTemplates() {
        const result = await pgPool.query("SELECT * FROM notification_templates ORDER BY event_key, channel");
        return result.rows.map(templateRow);
    }
    async upsertTemplate(data, actor) {
        const result = await pgPool.query(`INSERT INTO notification_templates
       (id, event_key, channel, subject_template, body_template, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (event_key) DO UPDATE SET
         channel = EXCLUDED.channel,
         subject_template = EXCLUDED.subject_template,
         body_template = EXCLUDED.body_template,
         active = EXCLUDED.active,
         updated_at = NOW()
       RETURNING *`, [
            data.id || randomUUID(),
            data.eventKey,
            data.channel || "email",
            data.subjectTemplate || "{{eventKey}}",
            data.bodyTemplate || "{{message}}",
            data.active !== false,
            actor?.name || actor?.email || "System",
        ]);
        return templateRow(result.rows[0]);
    }
    async enqueue(input) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(`INSERT INTO notification_jobs
         (id,event_key,workflow,resource_type,resource_id,payload,status,max_attempts,next_attempt_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,'queued',$7,NOW(),$8)
         RETURNING *`, [
                randomUUID(), input.eventKey, input.workflow || null,
                input.resourceType || null, input.resourceId || null,
                JSON.stringify(input.payload || {}), input.maxAttempts ?? 3,
                input.createdBy || "System",
            ]);
            for (const recipient of input.recipients) {
                await client.query(`INSERT INTO notification_recipients
           (id,job_id,channel,recipient,recipient_name,status)
           VALUES ($1,$2,$3,$4,$5,'queued')`, [randomUUID(), result.rows[0].id, recipient.channel, recipient.recipient, recipient.name || null]);
            }
            await client.query("COMMIT");
            return jobRow(result.rows[0]);
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    async processDue(limit = 25) {
        const result = await pgPool.query(`SELECT id FROM notification_jobs
       WHERE status IN ('queued','retrying')
         AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
       ORDER BY created_at LIMIT $1`, [Math.min(Math.max(limit, 1), 100)]);
        return Promise.all(result.rows.map((row) => this.processJob(row.id)));
    }
    async processJob(jobId) {
        const jobResult = await pgPool.query("SELECT * FROM notification_jobs WHERE id = $1", [jobId]);
        const job = jobRow(jobResult.rows[0]);
        if (!job)
            throw new Error("Notification job not found");
        const [recipientResult, templateResult] = await Promise.all([
            pgPool.query("SELECT * FROM notification_recipients WHERE job_id = $1 AND status IN ('queued','retrying','failed')", [jobId]),
            pgPool.query("SELECT * FROM notification_templates WHERE event_key = $1 AND active = TRUE", [job.eventKey]),
        ]);
        const templates = templateResult.rows.map(templateRow);
        let failed = 0;
        let delivered = 0;
        for (const rawRecipient of recipientResult.rows) {
            const recipient = recipientRow(rawRecipient);
            const template = templates.find((item) => item.channel === recipient.channel) || templates[0];
            const subject = renderTemplate(template?.subjectTemplate || job.eventKey, job.payload);
            const body = renderTemplate(template?.bodyTemplate || String(job.payload.message || ""), job.payload);
            const delivery = await this.deliver(recipient.channel, recipient.recipient, subject, body);
            await pgPool.query(`UPDATE notification_recipients SET
           status=$1, attempts=attempts+1, delivered_at=$2, failed_at=$3,
           last_error=$4, provider_message_id=$5, updated_at=NOW()
         WHERE id=$6`, [
                delivery.delivered ? "delivered" : "failed",
                delivery.delivered ? new Date() : null,
                delivery.delivered ? null : new Date(),
                delivery.error || null,
                delivery.providerMessageId || null,
                recipient.id,
            ]);
            if (delivery.delivered)
                delivered += 1;
            else
                failed += 1;
        }
        const attempts = job.attempts + 1;
        const nextAttemptAt = failed > 0 && attempts < job.maxAttempts
            ? new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000)
            : null;
        const status = failed === 0 ? "delivered" : nextAttemptAt ? "retrying" : "failed";
        await pgPool.query(`UPDATE notification_jobs SET status=$1, attempts=$2, next_attempt_at=$3,
       last_error=$4, updated_at=NOW() WHERE id=$5`, [status, attempts, nextAttemptAt, failed ? `${failed} recipient delivery failure(s)` : null, jobId]);
        return { jobId, status, delivered, failed, attempts, nextAttemptAt };
    }
    async listJobs(filters) {
        const values = [];
        let where = "";
        if (filters?.status) {
            values.push(filters.status);
            where = `WHERE status = $${values.length}`;
        }
        values.push(Math.min(Math.max(filters?.limit ?? 100, 1), 250));
        const result = await pgPool.query(`SELECT * FROM notification_jobs ${where} ORDER BY created_at DESC LIMIT $${values.length}`, values);
        return result.rows.map(jobRow);
    }
    async listRecipients(jobId) {
        const result = jobId
            ? await pgPool.query("SELECT * FROM notification_recipients WHERE job_id=$1 ORDER BY created_at DESC", [jobId])
            : await pgPool.query("SELECT * FROM notification_recipients ORDER BY created_at DESC LIMIT 250");
        return result.rows.map(recipientRow);
    }
    async dashboard() {
        const [jobs, recipients, failures] = await Promise.all([
            pgPool.query("SELECT status, COUNT(*)::int AS count FROM notification_jobs GROUP BY status"),
            pgPool.query("SELECT status, channel, COUNT(*)::int AS count FROM notification_recipients GROUP BY status, channel"),
            pgPool.query("SELECT * FROM notification_recipients WHERE status='failed' ORDER BY updated_at DESC LIMIT 25"),
        ]);
        return { jobs: jobs.rows, recipients: recipients.rows, failures: failures.rows.map(recipientRow) };
    }
    async createDigest(input) {
        const result = await pgPool.query(`INSERT INTO notification_digest_subscriptions
       (id,user_id,recipient,cadence,channels,active)
       VALUES ($1,$2,$3,$4,$5::jsonb,TRUE) RETURNING *`, [randomUUID(), input.userId || null, input.recipient, input.cadence || "daily", JSON.stringify(input.channels || ["email", "in-app"])]);
        const row = result.rows[0];
        return this.mapDigestRow(row);
    }
    async listDigests(filters) {
        const values = [];
        let where = "WHERE 1=1";
        if (filters?.userId) {
            values.push(filters.userId);
            where += ` AND user_id = $${values.length}`;
        }
        if (filters?.recipient) {
            values.push(filters.recipient);
            where += ` AND recipient = $${values.length}`;
        }
        const result = await pgPool.query(`SELECT * FROM notification_digest_subscriptions ${where} ORDER BY created_at DESC`, values);
        return result.rows.map(this.mapDigestRow);
    }
    async updateDigest(id, input) {
        const sets = [];
        const values = [];
        if (input.cadence !== undefined) {
            sets.push(`cadence = $${values.length + 1}`);
            values.push(input.cadence);
        }
        if (input.channels !== undefined) {
            sets.push(`channels = $${values.length + 1}::jsonb`);
            values.push(JSON.stringify(input.channels));
        }
        if (input.active !== undefined) {
            sets.push(`active = $${values.length + 1}`);
            values.push(input.active);
        }
        sets.push(`updated_at = NOW()`);
        values.push(id);
        const result = await pgPool.query(`UPDATE notification_digest_subscriptions SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`, values);
        const row = result.rows[0];
        if (!row)
            throw new Error("Digest subscription not found");
        return this.mapDigestRow(row);
    }
    async deleteDigest(id) {
        const result = await pgPool.query("DELETE FROM notification_digest_subscriptions WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0)
            throw new Error("Digest subscription not found");
        return { ok: true };
    }
    mapDigestRow(row) {
        return {
            id: row.id,
            userId: row.user_id,
            recipient: row.recipient,
            cadence: row.cadence,
            channels: row.channels,
            active: row.active,
            nextRunAt: row.next_run_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    async deliver(channel, recipient, subject, body) {
        if (channel === "in-app")
            return { delivered: true, providerMessageId: "in-app" };
        if (channel === "email") {
            try {
                const result = await sendTestEmail({ to: recipient, subject, message: body });
                return {
                    delivered: Boolean(result.delivered),
                    providerMessageId: result.mode,
                    error: result.delivered ? undefined : result.message,
                };
            }
            catch (error) {
                return { delivered: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        return { delivered: false, error: `${channel} provider is not configured in this deployment.` };
    }
}
export const notificationCenterService = new NotificationCenterService();
