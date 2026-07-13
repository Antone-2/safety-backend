import { randomUUID } from "node:crypto";

import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

export class OperationalMonitoringService {
  async recordEvent(input: {
    type: string;
    source: string;
    status: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const result = await pgPool.query(
      `INSERT INTO operational_events (id,type,source,status,message,metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
      [randomUUID(), input.type, input.source, input.status, input.message, JSON.stringify(input.metadata || {})],
    );
    return result.rows[0];
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
    const result = await pgPool.query(
      `INSERT INTO scheduler_runs
       (id,job_name,status,started_at,finished_at,duration_ms,error,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [randomUUID(), input.jobName, input.status, input.startedAt, input.finishedAt || null,
        input.durationMs ?? null, input.error || null, JSON.stringify(input.metadata || {})],
    );
    return result.rows[0];
  }

  async recordSlowQuery(input: {
    operation: string;
    durationMs: number;
    thresholdMs: number;
    metadata?: Record<string, unknown>;
  }) {
    const result = await pgPool.query(
      `INSERT INTO slow_query_logs (id,operation,duration_ms,threshold_ms,metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [randomUUID(), input.operation, input.durationMs, input.thresholdMs, JSON.stringify(input.metadata || {})],
    );
    return result.rows[0];
  }

  async dashboard() {
    const [events, scheduler, slowRequests, recentEvents] = await Promise.all([
      pgPool.query("SELECT type,status,COUNT(*)::int AS count FROM operational_events GROUP BY type,status"),
      pgPool.query(`SELECT job_name AS "jobName",status,COUNT(*)::int AS count,
                    MAX(started_at) AS "lastStartedAt" FROM scheduler_runs GROUP BY job_name,status`),
      pgPool.query("SELECT * FROM slow_query_logs ORDER BY created_at DESC LIMIT 50"),
      pgPool.query("SELECT * FROM operational_events ORDER BY created_at DESC LIMIT 50"),
    ]);
    return {
      events: events.rows,
      scheduler: scheduler.rows,
      slowRequests: slowRequests.rows,
      recentEvents: recentEvents.rows,
    };
  }
}

export const operationalMonitoringService = new OperationalMonitoringService();
