import { z } from "zod";
export const USER_ROLE_VALUES = [
    "super-admin",
    "EHS-manager",
    "EHS-officer",
    "she-committee-member",
    "supervisor",
    "gm",
    "plant-manager",
    "factory-manager",
    "depot-admin",
    "maintenance-manager",
    "issuer",
    "employee",
];
export const UserRoleSchema = z.enum(USER_ROLE_VALUES);
const nullableTrimmedString = (max) => z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
export const CreateUserSchema = z.object({
    email: z.string().trim().email(),
    name: z.string().trim().min(1).max(200),
    role: UserRoleSchema.default("employee"),
    phone: nullableTrimmedString(50),
    site: nullableTrimmedString(200),
    department: nullableTrimmedString(120),
    employeeNo: nullableTrimmedString(80),
    jobTitle: nullableTrimmedString(160),
    lineManagerId: z.string().trim().uuid().optional(),
    supervisorId: z.string().trim().uuid().optional(),
    active: z.boolean().optional().default(true),
});
export const UpdateUserSchema = CreateUserSchema.partial().extend({
    active: z.boolean().optional(),
});
export const UserFiltersSchema = z.object({
    search: z.string().trim().optional(),
    role: z.string().trim().optional(),
    site: z.string().trim().optional(),
    department: z.string().trim().optional(),
    active: z
        .union([z.boolean(), z.string().trim()])
        .optional()
        .transform((value) => {
        if (typeof value === "boolean")
            return value;
        if (value === "true")
            return true;
        if (value === "false")
            return false;
        return undefined;
    }),
    lineManagerId: z.string().trim().uuid().optional(),
    supervisorId: z.string().trim().uuid().optional(),
});
export const DelegationSchema = z.object({
    delegatedToUserId: z.string().trim().uuid(),
    delegatedFrom: z.string().trim().min(1).max(80),
    delegatedUntil: z.string().trim().datetime(),
});
