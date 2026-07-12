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
export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const StatusSchema = z.enum(["Open", "In Progress", "Closed"]);
export const ReportTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition"]);
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
