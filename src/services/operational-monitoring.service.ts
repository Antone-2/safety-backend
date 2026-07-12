import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";

const now = () => new Date().toISOString();

function parseJson(value: unknown, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export class OperationalMonitoringService {
  async recordEvent(input: {
    type: string;
    source: string;
    status: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = await getDb();
    const event = {
      id: uuidv4(),
      type: input.type,
      source: input.source,
      status: input.status,
      message: input.message,
      metadata: JSON.stringify(input.metadata || {}),
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO operational_events
       (id, type, source, status, message, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(event));
    await saveDb(db);
    return { ...event, metadata: input.metadata || {} };
  }

  async recordSchedulerRun(input: {
    jobName: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    durationMs?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = await getDb();
    const run = {
      id: uuidv4(),
      jobName: input.jobName,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt || null,
      durationMs: input.durationMs || null,
      error: input.error || null,
      metadata: JSON.stringify(input.metadata || {}),
    };
    db.prepare(
      `INSERT INTO scheduler_runs
       (id, jobName, status, startedAt, finishedAt, durationMs, error, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(run));
    await saveDb(db);
    return { ...run, metadata: input.metadata || {} };
  }

  async recordSlowQuery(input: {
    operation: string;
    durationMs: number;
    thresholdMs: number;
    metadata?: Record<string, unknown>;
  }) {
    const db = await getDb();
    const row = {
      id: uuidv4(),
      operation: input.operation,
      durationMs: input.durationMs,
      thresholdMs: input.thresholdMs,
      metadata: JSON.stringify(input.metadata || {}),
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO slow_query_logs
       (id, operation, durationMs, thresholdMs, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(row));
    await saveDb(db);
    return { ...row, metadata: input.metadata || {} };
  }

  async dashboard() {
    const db = await getDb();
    const events = allRows(
      db,
      "SELECT type, status, COUNT(*) AS count FROM operational_events GROUP BY type, status",
    );
    const scheduler = allRows(
      db,
      "SELECT jobName, status, COUNT(*) AS count, MAX(startedAt) AS lastStartedAt FROM scheduler_runs GROUP BY jobName, status",
    );
    const slowRequests = allRows(
      db,
      "SELECT * FROM slow_query_logs ORDER BY createdAt DESC LIMIT 50",
    ).map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
    const recentEvents = allRows(
      db,
      "SELECT * FROM operational_events ORDER BY createdAt DESC LIMIT 50",
    ).map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
    return { events, scheduler, slowRequests, recentEvents };
  }
}

export const operationalMonitoringService = new OperationalMonitoringService();
