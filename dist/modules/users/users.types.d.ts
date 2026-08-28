import { z } from "zod";
export declare const USER_ROLE_VALUES: readonly ["super-admin", "EHS-manager", "EHS-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer", "employee"];
export declare const UserRoleSchema: z.ZodEnum<["super-admin", "EHS-manager", "EHS-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer", "employee"]>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["super-admin", "EHS-manager", "EHS-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer", "employee"]>>;
    phone: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    site: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    department: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    employeeNo: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    jobTitle: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    lineManagerId: z.ZodOptional<z.ZodString>;
    supervisorId: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    role: "super-admin" | "EHS-manager" | "EHS-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | "employee";
    email: string;
    active: boolean;
    phone?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    employeeNo?: string | undefined;
    jobTitle?: string | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
}, {
    name: string;
    email: string;
    role?: "super-admin" | "EHS-manager" | "EHS-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | "employee" | undefined;
    phone?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    active?: boolean | undefined;
    employeeNo?: string | undefined;
    jobTitle?: string | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
}>;
export declare const UpdateUserSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodDefault<z.ZodEnum<["super-admin", "EHS-manager", "EHS-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer", "employee"]>>>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    site: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    department: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    employeeNo: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    jobTitle: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    lineManagerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supervisorId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    role?: "super-admin" | "EHS-manager" | "EHS-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | "employee" | undefined;
    phone?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    email?: string | undefined;
    active?: boolean | undefined;
    employeeNo?: string | undefined;
    jobTitle?: string | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
}, {
    name?: string | undefined;
    role?: "super-admin" | "EHS-manager" | "EHS-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | "employee" | undefined;
    phone?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    email?: string | undefined;
    active?: boolean | undefined;
    employeeNo?: string | undefined;
    jobTitle?: string | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
}>;
export declare const UserFiltersSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    active: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString]>>, boolean | undefined, string | boolean | undefined>;
    lineManagerId: z.ZodOptional<z.ZodString>;
    supervisorId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    active?: boolean | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
    search?: string | undefined;
}, {
    role?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    active?: string | boolean | undefined;
    lineManagerId?: string | undefined;
    supervisorId?: string | undefined;
    search?: string | undefined;
}>;
export declare const DelegationSchema: z.ZodObject<{
    delegatedToUserId: z.ZodString;
    delegatedFrom: z.ZodString;
    delegatedUntil: z.ZodString;
}, "strip", z.ZodTypeAny, {
    delegatedToUserId: string;
    delegatedFrom: string;
    delegatedUntil: string;
}, {
    delegatedToUserId: string;
    delegatedFrom: string;
    delegatedUntil: string;
}>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserFilters = z.infer<typeof UserFiltersSchema>;
export type DelegationInput = z.infer<typeof DelegationSchema>;
export type ManagedUser = {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    site?: string;
    department?: string;
    employeeNo?: string;
    jobTitle?: string;
    lineManagerId?: string;
    lineManagerName?: string;
    supervisorId?: string;
    supervisorName?: string;
    delegatedToUserId?: string;
    delegatedToUserName?: string;
    delegatedFrom?: string;
    delegatedUntil?: string;
    active: boolean;
    lockedUntil?: string;
    lastLoginAt?: string;
    status: "Active" | "Inactive" | "Locked" | "Delegated";
    createdAt: string;
    updatedAt: string;
};
