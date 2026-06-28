import { z } from "zod";

export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export const REPORT_SOURCE_MANUAL = "manual";

export const StatusSchema = z.enum(["Open", "In Progress", "Closed"]);
export type Status = z.infer<typeof StatusSchema>;

export const ReportTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export interface Report {
  id: string;
  date: string;
  location: string;
  reporter: string;
  description: string;
  severity: Severity;
  status: Status;
  category: string;
  type: ReportType;
  resolutionDays?: number;
  slaHours: number;
  dueAt: string;
  assignedTo?: string;
  comments: { author: string; at: string; text: string }[];
  isNearMiss: boolean;
  anonymous: boolean;
  department: string;
  shift: string;
  complianceRequired: boolean;
  complianceDueAt?: string;
  photoUrl: string;
  photos?: string[];
}

export const CreateReportSchema = z.object({
  location: z.string().min(1).max(200),
  reporter: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: SeveritySchema,
  category: z.string().min(1).max(100),
  type: ReportTypeSchema,
  department: z.string().min(1).max(100),
  shift: z.string().min(1).max(50),
  anonymous: z.boolean().optional().default(false),
  complianceRequired: z.boolean().optional().default(false),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^(https?:\/\/|data:|blob:)/i.test(value),
      "Photo URL must be a valid http(s), data, or blob URL",
    ),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const CapaStatusSchema = z.enum([
  "Pending",
  "In Progress",
  "Completed",
  "Verified",
]);
export type CapaStatus = z.infer<typeof CapaStatusSchema>;

export const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type CapaPriority = z.infer<typeof CapaPrioritySchema>;

export interface Capa {
  id: string;
  incidentId: string;
  rootCause: string;
  action: string;
  owner: string;
  dueDate: string;
  status: CapaStatus;
  priority: CapaPriority;
}

export const CreateCapaSchema = z.object({
  incidentId: z.string().min(1).max(50),
  rootCause: z.string().min(1).max(2000),
  action: z.string().min(1).max(5000),
  owner: z.string().min(1).max(200),
  dueDate: z.string().min(1),
  priority: CapaPrioritySchema.optional().default("Medium"),
});

export type CreateCapaInput = z.infer<typeof CreateCapaSchema>;

export interface SettingsPayload {
  sites: string[];
  hazards: string[];
  severities: { name: string; slaHours: number; color: string }[];
  schedule: { enabled: boolean; freq: string; email: string };
}

export const UserRoleSchema = z.enum([
  "super-admin",
  "sheq-manager",
  "she-committee-member",
  "supervisor",
  "gm",
  "plant-manager",
  "factory-manager",
  "depot-admin",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: UserRoleSchema,
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthToken {
  token: string;
  user: User;
}
