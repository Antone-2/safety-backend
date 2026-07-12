import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { sendTestEmail } from "../lib/email.js";

export type NotificationChannel = "email" | "sms" | "whatsapp" | "in-app";
export type NotificationRecipient = {
  channel: NotificationChannel;
  recipient: string;
  name?: string;
};

const now = () => new Date().toISOString();

function parseJson(value: unknown, fallback: unknown) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function stringify(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = key.split(".").reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[part];
    }, payload);
    return value === undefined || value === null ? "" : String(value);
  });
}

function normalizeTemplate(row: any) {
  return row
    ? {
        ...row,
        active: Boolean(row.active),
      }
    : row;
}

function normalizeJob(row: any) {
  return row
    ? {
        ...row,
        payload: parseJson(row.payload, {}),
      }
    : row;
}

function normalizeRecipient(row: any) {
  return row
    ? {
        ...row,
        attempts: Number(row.attempts || 0),
      }
    : row;
}

export class NotificationCenterService {
  async listTemplates() {
    const db = await getDb();
    return allRows(
      db,
      "SELECT * FROM notification_templates ORDER BY eventKey ASC, channel ASC",
    ).map(normalizeTemplate);
  }

  async upsertTemplate(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const db = await getDb();
    const createdAt = now();
    const template = {
      id: data.id || uuidv4(),
      eventKey: data.eventKey,
      channel: data.channel || "email",
      subjectTemplate: data.subjectTemplate || "{{eventKey}}",
      bodyTemplate: data.bodyTemplate || "{{message}}",
      active: data.active === false ? 0 : 1,
      createdBy: actor?.name || actor?.email || "System",
      createdAt,
      updatedAt: createdAt,
    };
    db.prepare(
      `INSERT OR REPLACE INTO notification_templates
       (id, eventKey, channel, subjectTemplate, bodyTemplate, active, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(template));
    await saveDb(db);
    return normalizeTemplate(template);
  }

  async enqueue(input: {
    eventKey: string;
    workflow?: string;
    resourceType?: string;
    resourceId?: string;
    payload?: Record<string, unknown>;
    recipients: NotificationRecipient[];
    createdBy?: string;
    maxAttempts?: number;
  }) {
    const db = await getDb();
    const createdAt = now();
    const job = {
      id: uuidv4(),
      eventKey: input.eventKey,
      workflow: input.workflow || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      payload: stringify(input.payload, {}),
      status: "queued",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      nextAttemptAt: createdAt,
      lastError: null,
      createdBy: input.createdBy || "System",
      createdAt,
      updatedAt: createdAt,
    };
    db.prepare(
      `INSERT INTO notification_jobs
       (id, eventKey, workflow, resourceType, resourceId, payload, status, attempts, maxAttempts, nextAttemptAt, lastError, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(job));

    const insertRecipient = db.prepare(
      `INSERT INTO notification_recipients
       (id, jobId, channel, recipient, recipientName, status, attempts, deliveredAt, failedAt, lastError, providerMessageId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const recipient of input.recipients) {
      insertRecipient.run([
        uuidv4(),
        job.id,
        recipient.channel,
        recipient.recipient,
        recipient.name || null,
        "queued",
        0,
        null,
        null,
        null,
        null,
        createdAt,
        createdAt,
      ]);
    }

    await saveDb(db);
    return normalizeJob(job);
  }

  async processDue(limit = 25) {
    const db = await getDb();
    const jobs = allRows(
      db,
      `SELECT * FROM notification_jobs
       WHERE status IN ('queued','retrying') AND (nextAttemptAt IS NULL OR nextAttemptAt <= ?)
       ORDER BY createdAt ASC LIMIT ?`,
      [now(), limit],
    ).map(normalizeJob);

    const results = [];
    for (const job of jobs) {
      results.push(await this.processJob(job.id));
    }
    return results;
  }

  async processJob(jobId: string) {
    const db = await getDb();
    const job = normalizeJob(
      allRows(db, "SELECT * FROM notification_jobs WHERE id = ?", [jobId])[0],
    );
    if (!job) throw new Error("Notification job not found");

    const recipients = allRows(
      db,
      "SELECT * FROM notification_recipients WHERE jobId = ? AND status IN ('queued','retrying','failed')",
      [jobId],
    ).map(normalizeRecipient);
    const templates = allRows(
      db,
      "SELECT * FROM notification_templates WHERE eventKey = ? AND active = 1",
      [job.eventKey],
    ).map(normalizeTemplate);

    let failed = 0;
    let delivered = 0;
    for (const recipient of recipients) {
      const template =
        templates.find((item) => item.channel === recipient.channel) ||
        templates.find((item) => item.channel === "email");
      const subject = renderTemplate(
        template?.subjectTemplate || job.eventKey,
        job.payload,
      );
      const body = renderTemplate(
        template?.bodyTemplate ||
          String((job.payload as Record<string, unknown>).message || ""),
        job.payload,
      );
      const result = await this.deliver(
        recipient.channel,
        recipient.recipient,
        subject,
        body,
      );
      const updatedAt = now();
      db.prepare(
        `UPDATE notification_recipients
         SET status = ?, attempts = attempts + 1, deliveredAt = ?, failedAt = ?, lastError = ?, providerMessageId = ?, updatedAt = ?
         WHERE id = ?`,
      ).run([
        result.delivered ? "delivered" : "failed",
        result.delivered ? updatedAt : null,
        result.delivered ? null : updatedAt,
        result.error || null,
        result.providerMessageId || null,
        updatedAt,
        recipient.id,
      ]);

      if (result.delivered) delivered += 1;
      else failed += 1;
    }

    const attempts = Number(job.attempts || 0) + 1;
    const nextAttemptAt =
      failed > 0 && attempts < Number(job.maxAttempts || 3)
        ? new Date(
            Date.now() + Math.min(60, 2 ** attempts) * 60000,
          ).toISOString()
        : null;
    const status =
      failed === 0 ? "delivered" : nextAttemptAt ? "retrying" : "failed";
    db.prepare(
      `UPDATE notification_jobs
       SET status = ?, attempts = ?, nextAttemptAt = ?, lastError = ?, updatedAt = ?
       WHERE id = ?`,
    ).run([
      status,
      attempts,
      nextAttemptAt,
      failed ? `${failed} recipient delivery failure(s)` : null,
      now(),
      jobId,
    ]);
    await saveDb(db);
    return { jobId, status, delivered, failed, attempts, nextAttemptAt };
  }

  async listJobs(filters?: { status?: string; limit?: number }) {
    const db = await getDb();
    let sql = "SELECT * FROM notification_jobs WHERE 1=1";
    const params: any[] = [];
    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    sql += " ORDER BY createdAt DESC LIMIT ?";
    params.push(filters?.limit ?? 100);
    return allRows(db, sql, params).map(normalizeJob);
  }

  async listRecipients(jobId?: string) {
    const db = await getDb();
    if (jobId) {
      return allRows(
        db,
        "SELECT * FROM notification_recipients WHERE jobId = ? ORDER BY createdAt DESC",
        [jobId],
      ).map(normalizeRecipient);
    }
    return allRows(
      db,
      "SELECT * FROM notification_recipients ORDER BY createdAt DESC LIMIT 250",
    ).map(normalizeRecipient);
  }

  async dashboard() {
    const db = await getDb();
    const jobs = allRows(
      db,
      "SELECT status, COUNT(*) AS count FROM notification_jobs GROUP BY status",
    );
    const recipients = allRows(
      db,
      "SELECT status, channel, COUNT(*) AS count FROM notification_recipients GROUP BY status, channel",
    );
    const failures = allRows(
      db,
      "SELECT * FROM notification_recipients WHERE status = 'failed' ORDER BY updatedAt DESC LIMIT 25",
    ).map(normalizeRecipient);
    return { jobs, recipients, failures };
  }

  async createDigest(input: {
    recipient: string;
    userId?: string;
    cadence?: string;
    channels?: NotificationChannel[];
  }) {
    const db = await getDb();
    const createdAt = now();
    const digest = {
      id: uuidv4(),
      userId: input.userId || null,
      recipient: input.recipient,
      cadence: input.cadence || "daily",
      channels: stringify(input.channels, ["email", "in-app"]),
      active: 1,
      nextRunAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    db.prepare(
      `INSERT INTO notification_digest_subscriptions
       (id, userId, recipient, cadence, channels, active, nextRunAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(digest));
    await saveDb(db);
    return { ...digest, channels: parseJson(digest.channels, []) };
  }

  private async deliver(
    channel: string,
    recipient: string,
    subject: string,
    body: string,
  ) {
    if (channel === "in-app") {
      const db = await getDb();
      db.prepare(
        `INSERT INTO notifications
         (id, reportId, channel, recipient, subject, message, delivered, createdAt, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run([uuidv4(), "", "in-app", recipient, subject, body, 1, now(), 0]);
      await saveDb(db);
      return { delivered: true, providerMessageId: "in-app" };
    }

    if (channel === "email") {
      try {
        const result = await sendTestEmail({
          to: recipient,
          subject,
          message: body,
        });
        return {
          delivered: Boolean(result.delivered),
          providerMessageId: result.mode,
          error: result.delivered ? undefined : result.message,
        };
      } catch (error) {
        return {
          delivered: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      delivered: false,
      error: `${channel} provider is not configured in this deployment.`,
    };
  }
}

export const notificationCenterService = new NotificationCenterService();
