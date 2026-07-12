import type { Request } from "express";
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
export declare function writeAuditLog(input: AuditLogInput): Promise<void>;
export declare function diffRecord(before: Record<string, unknown>, after: Record<string, unknown>): AuditChange[];
