import { BaseService } from "./base.service.js";
import { z } from "zod";

export const MedicalExamTypeSchema = z.enum(["Pre-employment", "Periodic", "Exit", "Incident-related", "Specific Hazard", "Other"]);
export type MedicalExamType = z.infer<typeof MedicalExamTypeSchema>;

export const MedicalRecordSchema = z.object({
  id: z.string().optional(),
  recordNo: z.string().optional(),
  employeeId: z.string().min(1).max(100),
  employeeName: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  examType: MedicalExamTypeSchema,
  examinationDate: z.string().min(1),
  nextDueDate: z.string().min(1),
  frequency: z.string().min(1).max(100),
  results: z.string().max(5000).optional(),
  findings: z.string().max(5000).optional(),
  restrictions: z.string().max(2000).optional(),
  fitnessForWork: z.boolean().default(true),
  doctorName: z.string().min(1).max(200),
  doctorRegistration: z.string().max(100).optional(),
  clinicName: z.string().max(200).optional(),
  reportUrl: z.string().optional(),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type MedicalRecordInput = z.infer<typeof MedicalRecordSchema>;

export class MedicalService extends BaseService {
  constructor() {
    super("medical_records", MedicalRecordSchema);
  }

  async createRecord(data: MedicalRecordInput) {
    const record = await this.create({ ...data, recordNo: `MED-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
    return record;
  }
  async getRecords(filters?: Record<string, any>) { return this.getAll(filters); }
  async getRecordById(id: string) { return this.getById(id); }
  async getRecordsByEmployee(employeeId: string) { return this.getAll({ employeeId }); }

  async getStats() {
    const db = (this as any).getDb?.() || require("../lib/database.js").getDb();
    const all = (this as any).allRows?.(db, `SELECT * FROM medical_records`) || [];
    const total = all.length;
    const fit = all.filter((r: any) => r.fitnessForWork).length;
    const restricted = all.filter((r: any) => !r.fitnessForWork).length;
    await (this as any).saveDb?.(db) || require("../lib/database.js").saveDb(db);
    return { total, fit, restricted };
  }
}
