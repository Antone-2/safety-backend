import { BaseService } from "./base.service.js";
import { z } from "zod";

export const AuditTypeSchema = z.enum(["Internal", "External", "Regulatory", "Management Review", "Surveillance"]);
export const AuditStatusSchema = z.enum(["Planned", "In Progress", "Completed", "Closed"]);

export type AuditType = z.infer<typeof AuditTypeSchema>;
export type AuditStatus = z.infer<typeof AuditStatusSchema>;

export const AuditFindingSchema = z.object({
  id: z.string().optional(),
  clause: z.string().max(100).optional(),
  description: z.string().min(1).max(2000),
  severity: z.enum(["Observation", "Minor NC", "Major NC", "Critical NC"]),
  correctiveAction: z.string().max(2000).optional(),
  responsible: z.string().max(200).optional(),
  dueDate: z.string().optional(),
  status: z.string().default("Open"),
});

export const AuditSchema = z.object({
  id: z.string().optional(),
  auditNo: z.string().optional(),
  title: z.string().min(1).max(300),
  type: AuditTypeSchema,
  status: AuditStatusSchema.default("Planned"),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  scope: z.string().max(5000).optional(),
  criteria: z.string().max(5000).optional(),
  leadAuditor: z.string().min(1).max(200),
  auditTeam: z.string().max(1000).optional(),
  auditee: z.string().max(200).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  findings: z.string().max(5000).optional(),
  summary: z.string().max(5000).optional(),
  reportUrl: z.string().optional(),
  reportPublished: z.boolean().default(false),
  createdBy: z.string().min(1).max(200),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type AuditInput = z.infer<typeof AuditSchema>;

export class AuditService extends BaseService {
  constructor() {
    super("audits", AuditSchema);
  }

  async createAudit(data: AuditInput) {
    const record = await this.create({
      ...data,
      auditNo: `AUD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    return record;
  }

  async getByStatus(status: string) {
    return this.getAll({ status });
  }

  async getByType(type: string) {
    return this.getAll({ type });
  }

  async getBySite(site: string) {
    return this.getAll({ site });
  }

  async getStats() {
    const db = await (this as any).getDb?.() || require("../lib/database.js").getDb();
    const all = (this as any).allRows?.(db, `SELECT * FROM audits`) || [];
    const total = all.length;
    const completed = all.filter((r: any) => r.status === "Completed").length;
    const inProgress = all.filter((r: any) => r.status === "In Progress").length;
    const planned = all.filter((r: any) => r.status === "Planned").length;
    await (this as any).saveDb?.(db) || require("../lib/database.js").saveDb(db);
    return { total, completed, inProgress, planned };
  }
}
