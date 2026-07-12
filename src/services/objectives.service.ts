import { BaseService } from "./base.service.js";
import { z } from "zod";

export const ObjectiveStatusSchema = z.enum(["Not Started", "In Progress", "On Track", "At Risk", "Off Track", "Achieved", "Cancelled"]);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const HseObjectiveSchema = z.object({
  id: z.string().optional(),
  objectiveNo: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  owner: z.string().min(1).max(200),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(50).optional(),
  baseline: z.string().max(200).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: ObjectiveStatusSchema.default("Not Started"),
  progress: z.number().min(0).max(100).default(0),
  linkedRisks: z.string().optional().default("[]"),
  linkedKpis: z.string().optional().default("[]"),
  linkedCapaIds: z.string().optional().default("[]"),
  evidence: z.string().max(2000).optional(),
  lastReviewed: z.string().optional(),
  reviewedBy: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});

export type HseObjectiveInput = z.infer<typeof HseObjectiveSchema>;

export class ObjectivesService extends BaseService {
  constructor() {
    super("hse_objectives", HseObjectiveSchema);
  }

  async createObjective(data: HseObjectiveInput) {
    const record = await this.create({
      ...data,
      objectiveNo: `OBJ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    return record;
  }

  async getByStatus(status: string) {
    return this.getAll({ status });
  }

  async getByDepartment(department: string) {
    return this.getAll({ department });
  }

  async getByOwner(owner: string) {
    return this.getAll({ owner });
  }

  async getAtRisk() {
    return this.getAll({ status: "At Risk" });
  }

  async getOffTrack() {
    return this.getAll({ status: "Off Track" });
  }

  async getStats() {
    const db = await (this as any).getDb?.() || require("../lib/database.js").getDb();
    const all = (this as any).allRows?.(db, `SELECT * FROM hse_objectives`) || [];
    const total = all.length;
    const achieved = all.filter((r: any) => r.status === "Achieved").length;
    const onTrack = all.filter((r: any) => r.status === "On Track").length;
    const atRisk = all.filter((r: any) => r.status === "At Risk").length;
    const offTrack = all.filter((r: any) => r.status === "Off Track").length;
    const notStarted = all.filter((r: any) => r.status === "Not Started").length;
    const completionRate = total > 0 ? Math.round((achieved / total) * 100) : 0;
    await (this as any).saveDb?.(db) || require("../lib/database.js").saveDb(db);
    return { total, achieved, onTrack, atRisk, offTrack, notStarted, completionRate };
  }
}
