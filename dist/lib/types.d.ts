import { z } from "zod";
export declare const SeveritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export declare const REPORT_SOURCE_MANUAL = "manual";
export declare const StatusSchema: z.ZodEnum<["Open", "In Progress", "Closed"]>;
export type Status = z.infer<typeof StatusSchema>;
export declare const ReportTypeSchema: z.ZodEnum<["Unsafe Act", "Unsafe Condition"]>;
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
    comments: {
        author: string;
        at: string;
        text: string;
    }[];
    isNearMiss: boolean;
    anonymous: boolean;
    department: string;
    shift: string;
    complianceRequired: boolean;
    complianceDueAt?: string;
    photoUrl: string;
}
export declare const CreateReportSchema: z.ZodObject<{
    location: z.ZodString;
    reporter: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    category: z.ZodString;
    type: z.ZodEnum<["Unsafe Act", "Unsafe Condition"]>;
    department: z.ZodString;
    shift: z.ZodString;
    anonymous: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    complianceRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    photoUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    location: string;
    reporter: string;
    description: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    category: string;
    department: string;
    anonymous: boolean;
    complianceRequired: boolean;
    photoUrl?: string | undefined;
}, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    location: string;
    reporter: string;
    description: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    category: string;
    department: string;
    anonymous?: boolean | undefined;
    complianceRequired?: boolean | undefined;
    photoUrl?: string | undefined;
}>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export declare const CapaStatusSchema: z.ZodEnum<["Pending", "In Progress", "Completed", "Verified"]>;
export type CapaStatus = z.infer<typeof CapaStatusSchema>;
export declare const CapaPrioritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
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
export declare const CreateCapaSchema: z.ZodObject<{
    incidentId: z.ZodString;
    rootCause: z.ZodString;
    action: z.ZodString;
    owner: z.ZodString;
    dueDate: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>>;
}, "strip", z.ZodTypeAny, {
    incidentId: string;
    rootCause: string;
    action: string;
    owner: string;
    dueDate: string;
    priority: "Low" | "Medium" | "High" | "Critical";
}, {
    incidentId: string;
    rootCause: string;
    action: string;
    owner: string;
    dueDate: string;
    priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
}>;
export type CreateCapaInput = z.infer<typeof CreateCapaSchema>;
export interface SettingsPayload {
    sites: string[];
    hazards: string[];
    severities: {
        name: string;
        slaHours: number;
        color: string;
    }[];
    schedule: {
        enabled: boolean;
        freq: string;
        email: string;
    };
}
export declare const UserRoleSchema: z.ZodEnum<["super-admin", "sheq-manager", "gm", "plant-manager", "factory-manager", "depot-admin"]>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["super-admin", "sheq-manager", "gm", "plant-manager", "factory-manager", "depot-admin"]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    name: string;
    role: "super-admin" | "sheq-manager" | "gm" | "plant-manager" | "factory-manager" | "depot-admin";
}, {
    email: string;
    password: string;
    name: string;
    role: "super-admin" | "sheq-manager" | "gm" | "plant-manager" | "factory-manager" | "depot-admin";
}>;
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
