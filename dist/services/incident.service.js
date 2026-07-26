import { BaseService } from "./base.service.js";
import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
const now = () => new Date().toISOString();
export const IncidentTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition", "Near Miss", "First Aid", "Medical Treatment", "Lost Time", "Fatality", "Property Damage", "Environmental"]);
export const IncidentSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const IncidentStatusSchema = z.enum(["Open", "Investigating", "Root Cause Analysis", "CAPA Open", "Closed"]);
export const IncidentSchema = z.object({
    id: z.string().optional(),
    type: IncidentTypeSchema,
    severity: IncidentSeveritySchema,
    status: IncidentStatusSchema.default("Open"),
    location: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    shift: z.string().min(1).max(50),
    description: z.string().min(1).max(5000),
    reporter: z.string().min(1).max(200),
    reporterEmail: z.string().email().optional(),
    reporterPhone: z.string().max(20).optional(),
    anonymous: z.boolean().default(false),
    isNearMiss: z.boolean().default(false),
    photoUrl: z.string().optional(),
    photos: z.array(z.string()).optional(),
    assignedTo: z.string().optional(),
    assignedToCopy: z.array(z.string()).optional(),
    slaHours: z.number().default(24),
    dueAt: z.string().optional(),
    resolutionDays: z.number().optional(),
    rootCause: z.string().optional(),
    correctiveAction: z.string().optional(),
    preventiveAction: z.string().optional(),
    investigationMethod: z.string().optional(),
    witnessStatement: z.string().optional(),
    regulatoryNotificationRequired: z.boolean().default(false),
    regulatoryNotificationDate: z.string().optional(),
    complianceRequired: z.boolean().default(false),
    complianceDueAt: z.string().optional(),
    source: z.string().default("manual"),
    auditHistory: z.string().optional(),
});
export class IncidentService extends BaseService {
    constructor() {
        super("incidents", IncidentSchema);
    }
    async createIncident(data) {
        const record = await this.create(data);
        return record;
    }
    async getByStatus(status) {
        return this.getAll({ status });
    }
    async getBySeverity(severity) {
        return this.getAll({ severity });
    }
    async getByLocation(location) {
        return this.getAll({ location });
    }
    async getOverdue() {
        const result = await pgPool.query(`SELECT * FROM ${this.tableName} WHERE status != 'Closed' AND "dueAt" < $1`, [now()]);
        return result.rows;
    }
    async getCriticalOpen() {
        const result = await pgPool.query(`SELECT * FROM ${this.tableName} WHERE severity = 'Critical' AND status != 'Closed'`);
        return result.rows;
    }
    async getStats() {
        const total = await this.count();
        const open = await this.count({ status: "Open" });
        const closed = await this.count({ status: "Closed" });
        const todayResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE "createdAt" >= NOW()::date`);
        const today = Number(todayResult.rows[0]?.count ?? 0);
        const weekResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE "createdAt" >= NOW() - INTERVAL '7 days'`);
        const week = Number(weekResult.rows[0]?.count ?? 0);
        return { total, open, closed, today, week };
    }
}
