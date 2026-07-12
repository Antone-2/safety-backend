import { BaseService } from "./base.service.js";
import { z } from "zod";

export const ScaffoldStatusSchema = z.enum(["Erected", "In Use", "Under Inspection", "Dismantled", "Tagged Out"]);
export type ScaffoldStatus = z.infer<typeof ScaffoldStatusSchema>;

export const ScaffoldSchema = z.object({
  id: z.string().optional(),
  scaffoldNo: z.string().optional(),
  location: z.string().min(1).max(200),
  building: z.string().min(1).max(100),
  floor: z.string().max(50).optional(),
  room: z.string().max(100).optional(),
  type: z.string().min(1).max(100),
  height: z.number().min(0),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  erectedBy: z.string().min(1).max(200),
  erectedDate: z.string().optional(),
  inspectedBy: z.string().max(200).optional(),
  inspectedDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  status: ScaffoldStatusSchema.default("Erected"),
  tagNumber: z.string().max(50).optional(),
  photos: z.string().optional().default("[]"),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type ScaffoldInput = z.infer<typeof ScaffoldSchema>;

export class ScaffoldService extends BaseService {
  constructor() {
    super("scaffolds", ScaffoldSchema);
  }

  async createScaffold(data: ScaffoldInput) {
    const record = await this.create({ ...data, scaffoldNo: `SCAF-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
    return record;
  }
  async getScaffolds(filters?: Record<string, any>) { return this.getAll(filters); }
  async getScaffoldById(id: string) { return this.getById(id); }

  async getStats() {
    const db = (this as any).getDb?.() || require("../lib/database.js").getDb();
    const all = (this as any).allRows?.(db, `SELECT * FROM scaffolds`) || [];
    const total = all.length;
    const inUse = all.filter((r: any) => r.status === "In Use").length;
    const needsInspection = all.filter((r: any) => r.status === "Under Inspection").length;
    const taggedOut = all.filter((r: any) => r.status === "Tagged Out").length;
    await (this as any).saveDb?.(db) || require("../lib/database.js").saveDb(db);
    return { total, inUse, needsInspection, taggedOut };
  }
}
