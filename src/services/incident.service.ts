import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, saveDb, allRows } from "../lib/database.js";

const now = () => new Date().toISOString();

export const IncidentTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition", "Near Miss", "First Aid", "Medical Treatment", "Lost Time", "Fatality", "Property Damage", "Environmental"]);
export const IncidentSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const IncidentStatusSchema = z.enum(["Open", "Investigating", "Root Cause Analysis", "CAPA Open", "Closed"]);

export type IncidentType = z.infer<typeof IncidentTypeSchema>;
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

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

export type IncidentInput = z.infer<typeof IncidentSchema>;

export class IncidentService extends BaseService {
  constructor() {
    super("incidents", IncidentSchema);
  }

  async createIncident(data: IncidentInput) {
    const record = await this.create(data);
    await this.ensureColumn(await getDb(), this.tableName, "type", "TEXT NOT NULL DEFAULT 'Unsafe Act'");
    await this.ensureColumn(await getDb(), this.tableName, "severity", "TEXT NOT NULL DEFAULT 'Medium'");
    await this.ensureColumn(await getDb(), this.tableName, "status", "TEXT NOT NULL DEFAULT 'Open'");
    await this.ensureColumn(await getDb(), this.tableName, "location", "TEXT NOT NULL");
    await this.ensureColumn(await getDb(), this.tableName, "department", "TEXT NOT NULL");
    await this.ensureColumn(await getDb(), this.tableName, "shift", "TEXT NOT NULL");
    await this.ensureColumn(await getDb(), this.tableName, "description", "TEXT NOT NULL");
    await this.ensureColumn(await getDb(), this.tableName, "reporter", "TEXT NOT NULL");
    await this.ensureColumn(await getDb(), this.tableName, "anonymous", "INTEGER NOT NULL DEFAULT 0");
    await this.ensureColumn(await getDb(), this.tableName, "isNearMiss", "INTEGER NOT NULL DEFAULT 0");
    await this.ensureColumn(await getDb(), this.tableName, "photoUrl", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "assignedTo", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "slaHours", "INTEGER NOT NULL DEFAULT 24");
    await this.ensureColumn(await getDb(), this.tableName, "dueAt", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "resolutionDays", "INTEGER");
    await this.ensureColumn(await getDb(), this.tableName, "rootCause", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "correctiveAction", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "preventiveAction", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "investigationMethod", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "witnessStatement", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "regulatoryNotificationRequired", "INTEGER NOT NULL DEFAULT 0");
    await this.ensureColumn(await getDb(), this.tableName, "regulatoryNotificationDate", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "complianceRequired", "INTEGER NOT NULL DEFAULT 0");
    await this.ensureColumn(await getDb(), this.tableName, "complianceDueAt", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "source", "TEXT NOT NULL DEFAULT 'manual'");
    await this.ensureColumn(await getDb(), this.tableName, "auditHistory", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "photos", "TEXT NOT NULL DEFAULT '[]'");
    await this.ensureColumn(await getDb(), this.tableName, "reporterEmail", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "reporterPhone", "TEXT");
    await this.ensureColumn(await getDb(), this.tableName, "assignedToCopy", "TEXT");
    return record;
  }

  async getByStatus(status: string) {
    return this.getAll({ status });
  }

  async getBySeverity(severity: string) {
    return this.getAll({ severity });
  }

  async getByLocation(location: string) {
    return this.getAll({ location });
  }

  async getOverdue() {
    const db = await getDb();
    const rows = allRows(db, `SELECT * FROM ${this.tableName} WHERE status != 'Closed' AND dueAt < ?`, [now()]);
    await saveDb(db);
    return rows;
  }

  async getCriticalOpen() {
    const db = await getDb();
    const rows = allRows(db, `SELECT * FROM ${this.tableName} WHERE severity = 'Critical' AND status != 'Closed'`);
    await saveDb(db);
    return rows;
  }

  async getStats() {
    const db = await getDb();
    const total = await this.count();
    const open = await this.count({ status: "Open" });
    const closed = await this.count({ status: "Closed" });
    const today = allRows(db, `SELECT COUNT(*) as count FROM ${this.tableName} WHERE date(createdAt) = date('now')`)[0]?.count || 0;
    const week = allRows(db, `SELECT COUNT(*) as count FROM ${this.tableName} WHERE date(createdAt) >= date('now', '-7 days')`)[0]?.count || 0;
    await saveDb(db);
    return { total, open, closed, today, week };
  }
}
