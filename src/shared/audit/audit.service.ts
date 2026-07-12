import type { Request } from "express";
import { pgPool } from "../infrastructure/database/postgres.client.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export type AuditChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type AuditLogInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: AuditChange[];
  context?: Record<string, unknown>;
  actor?: AuthRequest["user"];
  request?: Request;
};

function getIpAddress(req?: Request) {
  if (!req) return undefined;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]?.trim();
  return req.ip || req.socket.remoteAddress;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await pgPool.query(
    `INSERT INTO audit_logs (
      actor_id,
      actor_email,
      actor_role,
      action,
      resource_type,
      resource_id,
      changes,
      context,
      ip_address,
      user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
    [
      input.actor?.id ?? null,
      input.actor?.email ?? null,
      input.actor?.role ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      JSON.stringify(input.changes ?? []),
      JSON.stringify(input.context ?? {}),
      getIpAddress(input.request),
      input.request?.headers["user-agent"] ?? null,
    ],
  );
}

export function diffRecord(before: Record<string, unknown>, after: Record<string, unknown>): AuditChange[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChange[] = [];

  for (const field of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes.push({ field, before: before[field], after: after[field] });
    }
  }

  return changes;
}
