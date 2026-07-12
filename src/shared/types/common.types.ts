import { z } from "zod";

export const UserRoleSchema = z.enum([
  "super-admin",
  "EHS-manager",
  "she-committee-member",
  "supervisor",
  "gm",
  "plant-manager",
  "factory-manager",
  "depot-admin",
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

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

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

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

export interface Investigation {
  id: string;
  incidentId: string;
  title: string;
  description: string;
  investigator: string;
  status: string;
  priority: string;
  evidence: { name: string; url: string; uploadedAt: string; uploadedBy: string }[];
  rootCause?: string;
  correctiveActions?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Capa {
  id: string;
  incidentId: string;
  title: string;
  action: string;
  owner: string;
  dueDate: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: UserRoleSchema,
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
