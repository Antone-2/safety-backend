import { z } from "zod";
export declare const UserRoleSchema: z.ZodEnum<["super-admin", "EHS-manager", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "hse-officer", "employee"]>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    passwordHash: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    role: z.ZodEnum<["super-admin", "EHS-manager", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "hse-officer", "employee"]>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["Active", "Inactive", "Locked"]>>;
    lastLogin: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "Active" | "Inactive" | "Locked";
    role: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "employee";
    name: string;
    email: string;
    id?: string | undefined;
    phone?: string | undefined;
    passwordHash?: string | undefined;
    createdAt?: string | undefined;
    department?: string | undefined;
    site?: string | undefined;
    avatarUrl?: string | undefined;
    lastLogin?: string | undefined;
}, {
    role: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "employee";
    name: string;
    email: string;
    status?: "Active" | "Inactive" | "Locked" | undefined;
    id?: string | undefined;
    phone?: string | undefined;
    passwordHash?: string | undefined;
    createdAt?: string | undefined;
    department?: string | undefined;
    site?: string | undefined;
    avatarUrl?: string | undefined;
    lastLogin?: string | undefined;
}>;
export declare const PermissionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["super-admin", "EHS-manager", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "hse-officer", "employee"]>;
    resource: z.ZodString;
    actions: z.ZodString;
    conditions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "employee";
    resource: string;
    actions: string;
    id?: string | undefined;
    conditions?: string | undefined;
}, {
    role: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "employee";
    resource: string;
    actions: string;
    id?: string | undefined;
    conditions?: string | undefined;
}>;
export declare const AuditLogSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    actor: z.ZodString;
    actorRole: z.ZodOptional<z.ZodString>;
    action: z.ZodString;
    resource: z.ZodString;
    resourceId: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: string;
    resource: string;
    actor: string;
    timestamp: string;
    id?: string | undefined;
    actorRole?: string | undefined;
    resourceId?: string | undefined;
    details?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}, {
    action: string;
    resource: string;
    actor: string;
    id?: string | undefined;
    actorRole?: string | undefined;
    resourceId?: string | undefined;
    details?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    timestamp?: string | undefined;
}>;
export declare class GovernanceService {
    private userService;
    private permissionService;
    private auditService;
    constructor();
    createUser(data: Omit<z.infer<typeof UserSchema>, "id" | "createdAt"> & {
        password?: string;
    }): Promise<any>;
    getUsers(filters?: Record<string, any>): Promise<any[]>;
    getUserById(id: string): Promise<any>;
    updateUser(id: string, data: Record<string, any>): Promise<any>;
    deleteUser(id: string): Promise<boolean>;
    createPermission(data: z.infer<typeof PermissionSchema>): Promise<any>;
    getPermissions(): Promise<any[]>;
    logAudit(data: z.infer<typeof AuditLogSchema>): Promise<any>;
    getAuditLogs(filters?: Record<string, any>): Promise<any[]>;
    getGovernanceStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        todayLogs: number;
    }>;
}
