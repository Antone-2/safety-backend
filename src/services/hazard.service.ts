import { BaseService } from "./base.service.js";
import { z } from "zod";

export const HazardCategorySchema = z.enum(["Slip/Trip", "Chemical Spill", "PPE Violation", "Electrical", "Falling Object", "Vehicle/Forklift", "Inhalation/Fumes", "Fire/Ignition", "Manual Handling", "Noise Exposure", "Confined Space", "Fall from Height", "Other"]);
export type HazardCategory = z.infer<typeof HazardCategorySchema>;

export const HazardReportSchema = z.object({
  id: z.string().optional(),
  reportNo: z.string().optional(),
  category: HazardCategorySchema,
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  riskLevel: z.string().optional(),
  existingControls: z.string().max(2000).optional(),
  recommendedActions: z.string().max(2000).optional(),
  immediateActionTaken: z.string().max(2000).optional(),
  reportedBy: z.string().min(1).max(200),
  reportedAt: z.string().optional(),
  status: z.string().default("Open"),
  assignedTo: z.string().max(200).optional(),
  resolvedAt: z.string().optional(),
  resolution: z.string().max(2000).optional(),
  photoUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type HazardReportInput = z.infer<typeof HazardReportSchema>;

export class HazardService extends BaseService {
  constructor() {
    super("hazard_reports", HazardReportSchema);
  }

  async createReport(data: HazardReportInput) {
    const record = await this.create({ ...data, reportNo: `HAZ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
    return record;
  }
  async getReports(filters?: Record<string, any>) { return this.getAll(filters); }
  async getReportById(id: string) { return this.getById(id); }

  async getStats() {
    const db = (this as any).getDb?.() || require("../lib/database.js").getDb();
    const all = (this as any).allRows?.(db, `SELECT * FROM hazard_reports`) || [];
    const total = all.length;
    const open = all.filter((r: any) => r.status === "Open").length;
    const critical = all.filter((r: any) => r.severity === "Critical").length;
    const high = all.filter((r: any) => r.severity === "High").length;
    await (this as any).saveDb?.(db) || require("../lib/database.js").saveDb(db);
    return { total, open, critical, high };
  }
}
