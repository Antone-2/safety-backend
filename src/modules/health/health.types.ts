import { z } from "zod";

export const SurveillanceTypeSchema = z.enum(["Audiometric", "Respiratory", "Vision", "Hearing", "Blood", "Urine", "Physical", "Other"]);
export type SurveillanceType = z.infer<typeof SurveillanceTypeSchema>;

export interface HealthRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  site: string;
  type: SurveillanceType;
  examinationDate: string;
  nextDueDate: string;
  frequency: string;
  results?: string;
  findings?: string;
  restrictions?: string;
  fitnessForWork: boolean;
  doctorName: string;
  doctorRegistration?: string;
  clinicName?: string;
  reportUrl?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateHealthRecordSchema = z.object({
  employeeId: z.string().min(1).max(100),
  employeeName: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  type: SurveillanceTypeSchema,
  examinationDate: z.string().min(1),
  nextDueDate: z.string().min(1),
  frequency: z.string().min(1).max(50),
  results: z.string().max(2000).optional(),
  findings: z.string().max(1000).optional(),
  restrictions: z.string().max(500).optional(),
  fitnessForWork: z.boolean(),
  doctorName: z.string().min(1).max(200),
  doctorRegistration: z.string().max(100).optional(),
  clinicName: z.string().max(200).optional(),
  reportUrl: z.string().optional(),
  notes: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateHealthRecordInput = z.infer<typeof CreateHealthRecordSchema>;

export const UpdateHealthRecordSchema = z.object({
  employeeId: z.string().min(1).max(100).optional(),
  employeeName: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  site: z.string().min(1).max(200).optional(),
  type: SurveillanceTypeSchema.optional(),
  examinationDate: z.string().min(1).optional(),
  nextDueDate: z.string().min(1).optional(),
  frequency: z.string().min(1).max(50).optional(),
  results: z.string().max(2000).optional().nullable(),
  findings: z.string().max(1000).optional().nullable(),
  restrictions: z.string().max(500).optional().nullable(),
  fitnessForWork: z.boolean().optional(),
  doctorName: z.string().min(1).max(200).optional(),
  doctorRegistration: z.string().max(100).optional().nullable(),
  clinicName: z.string().max(200).optional().nullable(),
  reportUrl: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateHealthRecordInput = z.infer<typeof UpdateHealthRecordSchema>;

export interface HealthStats {
  total: number;
  fitForWork: number;
  notFit: number;
  audiometric: number;
  respiratory: number;
}
