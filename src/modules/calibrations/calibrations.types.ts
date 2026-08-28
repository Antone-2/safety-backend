import { z } from "zod";

export const CalibrationCriticalitySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const CalibrationTypeSchema = z.enum([
  "Initial",
  "Routine",
  "External Lab",
  "Internal Check",
  "Repair Verification",
]);
export const CalibrationStatusSchema = z.enum([
  "Planned",
  "Calibrated",
  "Overdue",
  "Out of Service",
]);

export type CalibrationCriticality = z.infer<typeof CalibrationCriticalitySchema>;
export type CalibrationType = z.infer<typeof CalibrationTypeSchema>;
export type CalibrationStatus = z.infer<typeof CalibrationStatusSchema>;

export interface CalibrationRecord {
  id: string;
  calibrationNo: string;
  equipmentId?: string;
  equipmentName: string;
  equipmentType?: string;
  site: string;
  department: string;
  location?: string;
  criticality: CalibrationCriticality;
  calibrationType: CalibrationType;
  status: CalibrationStatus;
  lastCalibrationDate?: string;
  dueDate: string;
  performedBy?: string;
  certificateNo?: string;
  certificateUrl?: string;
  tolerance?: string;
  resultSummary?: string;
  passed: boolean;
  outOfTolerance: boolean;
  actionRequired?: string;
  actionOwner?: string;
  actionDueDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationStats {
  total: number;
  planned: number;
  calibrated: number;
  overdue: number;
  outOfService: number;
  outOfTolerance: number;
  certificatesMissing: number;
}

export const CreateCalibrationSchema = z.object({
  equipmentId: z.string().max(120).optional(),
  equipmentName: z.string().min(1).max(200),
  equipmentType: z.string().max(120).optional(),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
  criticality: CalibrationCriticalitySchema.default("High"),
  calibrationType: CalibrationTypeSchema.default("Routine"),
  status: CalibrationStatusSchema.default("Planned"),
  lastCalibrationDate: z.string().optional(),
  dueDate: z.string().min(1),
  performedBy: z.string().max(200).optional(),
  certificateNo: z.string().max(120).optional(),
  certificateUrl: z.string().optional(),
  tolerance: z.string().max(200).optional(),
  resultSummary: z.string().max(2000).optional(),
  passed: z.boolean().default(true),
  outOfTolerance: z.boolean().default(false),
  actionRequired: z.string().max(1000).optional(),
  actionOwner: z.string().max(200).optional(),
  actionDueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateCalibrationInput = z.infer<typeof CreateCalibrationSchema>;

export const UpdateCalibrationSchema = z.object({
  equipmentId: z.string().max(120).optional().nullable(),
  equipmentName: z.string().min(1).max(200).optional(),
  equipmentType: z.string().max(120).optional().nullable(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(120).optional(),
  location: z.string().max(200).optional().nullable(),
  criticality: CalibrationCriticalitySchema.optional(),
  calibrationType: CalibrationTypeSchema.optional(),
  status: CalibrationStatusSchema.optional(),
  lastCalibrationDate: z.string().optional().nullable(),
  dueDate: z.string().min(1).optional(),
  performedBy: z.string().max(200).optional().nullable(),
  certificateNo: z.string().max(120).optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  tolerance: z.string().max(200).optional().nullable(),
  resultSummary: z.string().max(2000).optional().nullable(),
  passed: z.boolean().optional(),
  outOfTolerance: z.boolean().optional(),
  actionRequired: z.string().max(1000).optional().nullable(),
  actionOwner: z.string().max(200).optional().nullable(),
  actionDueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type UpdateCalibrationInput = z.infer<typeof UpdateCalibrationSchema>;
