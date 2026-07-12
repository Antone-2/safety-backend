import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, saveDb, allRows } from "../lib/database.js";

const now = () => new Date().toISOString();

export const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const CapaStatusSchema = z.enum(["Open", "In Progress", "Completed", "Overdue", "Cancelled"]);
export const CapaTypeSchema = z.enum(["Corrective", "Preventive", "Improvement"]);

export type CapaPriority = z.infer<typeof CapaPrioritySchema>;
export type CapaStatus = z.infer<typeof CapaStatusSchema>;
export type CapaType = z.infer<typeof CapaTypeSchema>;

export const CapaSchema = z.object({
  id: z.string().optional(),
  capaNo: z.string().optional(),
  type: CapaTypeSchema.default("Corrective"),
  status: CapaStatusSchema.default("Open"),
  priority: CapaPrioritySchema.default("Medium"),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  source: z.string().min(1).max(100),
  sourceRef: z.string().max(100).optional(),
  linkedIncidentId: z.string().optional(),
  linkedAuditId: z.string().optional(),
  linkedRiskId: z.string().optional(),
  rootCause: z.string().max(5000).optional(),
  actionPlan: z.string().min(1).max(5000),
  owner: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  dueDate: z.string().min(1),
  startDate: z.string().optional(),
  completedDate: z.string().optional(),
  verificationNote: z.string().max(2000).optional(),
  verifiedBy: z.string().max(200).optional(),
  verifiedAt: z.string().optional(),
  effectivenessCheck: z.string().max(2000).optional(),
  effectivenessResult: z.string().max(200).optional(),
  costEstimate: z.number().optional(),
  actualCost: z.number().optional(),
  attachments: z.string().optional().default("[]"),
  createdBy: z.string().min(1).max(200),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CapaInput = z.infer<typeof CapaSchema>;

export class CapaService extends BaseService {
  constructor() {
    super("capa", CapaSchema);
  }

  async createCapa(data: CapaInput) {
    const record = await this.create({
      ...data,
      capaNo: `CAPA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    return record;
  }

  async getByStatus(status: string) {
    return this.getAll({ status });
  }

  async getByPriority(priority: string) {
    return this.getAll({ priority });
  }

  async getByOwner(owner: string) {
    return this.getAll({ owner });
  }

  async getOverdue() {
    const db = await getDb();
    const rows = allRows(db, `SELECT * FROM capa WHERE status != 'Closed' AND status != 'Cancelled' AND dueDate < ?`, [now()]);
    await saveDb(db);
    return rows;
  }

  async getStats() {
    const db = await getDb();
    const all = allRows(db, `SELECT * FROM capa`);
    const total = all.length;
    const open = all.filter((r: any) => r.status === "Open").length;
    const inProgress = all.filter((r: any) => r.status === "In Progress").length;
    const completed = all.filter((r: any) => r.status === "Completed").length;
    const overdue = all.filter((r: any) => r.status !== "Cancelled" && r.status !== "Completed" && r.dueDate < now()).length;
    await saveDb(db);
    return { total, open, inProgress, completed, overdue };
  }

  async getCapaDashboard() {
    const records = await this.getAll();
    const total = records.length;
    const open = records.filter((r: any) => r.status === "Open").length;
    const inProgress = records.filter((r: any) => r.status === "In Progress").length;
    const completed = records.filter((r: any) => r.status === "Completed").length;
    const overdue = records.filter((r: any) => r.status !== "Cancelled" && r.status !== "Completed" && r.dueDate < now()).length;
    const highPriority = records.filter((r: any) => r.priority === "High" || r.priority === "Critical").length;
    const sources: Record<string, number> = {};
    records.forEach((r: any) => { sources[r.source] = (sources[r.source] || 0) + 1; });
    return { total, open, inProgress, completed, overdue, highPriority, sources };
  }
}
