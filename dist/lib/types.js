import { z } from "zod";
export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export const REPORT_SOURCE_MANUAL = "manual";
export const StatusSchema = z.enum(["Open", "In Progress", "Closed"]);
export const ReportTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition"]);
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
        .refine((value) => !value || /^(https?:\/\/|data:|blob:)/i.test(value), "Photo URL must be a valid http(s), data, or blob URL"),
});
export const CapaStatusSchema = z.enum([
    "Pending",
    "In Progress",
    "Completed",
    "Verified",
]);
export const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const CreateCapaSchema = z.object({
    incidentId: z.string().min(1).max(50),
    rootCause: z.string().min(1).max(2000),
    action: z.string().min(1).max(5000),
    owner: z.string().min(1).max(200),
    dueDate: z.string().min(1),
    priority: CapaPrioritySchema.optional().default("Medium"),
});
export const UserRoleSchema = z.enum([
    "super-admin",
    "sheq-manager",
    "gm",
    "plant-manager",
    "factory-manager",
    "depot-admin",
]);
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
