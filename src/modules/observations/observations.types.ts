import { z } from "zod";

export const ObservationTypeSchema = z.enum([
  "Positive",
  "At Risk",
  "Improvement",
]);

export const ObservationStatusSchema = z.enum([
  "Open",
  "Coaching Logged",
  "Closed",
]);

export const ObservationSeveritySchema = z.enum([
  "Low",
  "Medium",
  "High",
]);

export type ObservationType = z.infer<typeof ObservationTypeSchema>;
export type ObservationStatus = z.infer<typeof ObservationStatusSchema>;
export type ObservationSeverity = z.infer<typeof ObservationSeveritySchema>;

export interface ObservationRecord {
  id: string;
  title: string;
  type: ObservationType;
  category: string;
  behavior: string;
  location: string;
  site: string;
  department: string;
  observerName: string;
  observerDepartment?: string;
  observedPerson?: string;
  observedTeam?: string;
  shift?: string;
  observationDate: string;
  severity: ObservationSeverity;
  status: ObservationStatus;
  immediateAction?: string;
  coachingNote?: string;
  assignedTo?: string;
  dueDate?: string;
  followUpRequired: boolean;
  verificationNote?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObservationStats {
  total: number;
  positive: number;
  atRisk: number;
  improvement: number;
  open: number;
  coachingLogged: number;
  closed: number;
  followUpRequired: number;
}

export const CreateObservationSchema = z.object({
  title: z.string().min(1).max(200),
  type: ObservationTypeSchema,
  category: z.string().min(1).max(120),
  behavior: z.string().min(1).max(2000),
  location: z.string().min(1).max(200),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  observerName: z.string().min(1).max(200),
  observerDepartment: z.string().max(100).optional(),
  observedPerson: z.string().max(200).optional(),
  observedTeam: z.string().max(200).optional(),
  shift: z.string().max(50).optional(),
  observationDate: z.string().min(1),
  severity: ObservationSeveritySchema.default("Low"),
  status: ObservationStatusSchema.default("Open"),
  immediateAction: z.string().max(2000).optional(),
  coachingNote: z.string().max(2000).optional(),
  assignedTo: z.string().max(200).optional(),
  dueDate: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  verificationNote: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateObservationInput = z.infer<typeof CreateObservationSchema>;

export const UpdateObservationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: ObservationTypeSchema.optional(),
  category: z.string().min(1).max(120).optional(),
  behavior: z.string().min(1).max(2000).optional(),
  location: z.string().min(1).max(200).optional(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  observerName: z.string().min(1).max(200).optional(),
  observerDepartment: z.string().max(100).optional().nullable(),
  observedPerson: z.string().max(200).optional().nullable(),
  observedTeam: z.string().max(200).optional().nullable(),
  shift: z.string().max(50).optional().nullable(),
  observationDate: z.string().min(1).optional(),
  severity: ObservationSeveritySchema.optional(),
  status: ObservationStatusSchema.optional(),
  immediateAction: z.string().max(2000).optional().nullable(),
  coachingNote: z.string().max(2000).optional().nullable(),
  assignedTo: z.string().max(200).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  followUpRequired: z.boolean().optional(),
  verificationNote: z.string().max(2000).optional().nullable(),
});
export type UpdateObservationInput = z.infer<typeof UpdateObservationSchema>;
