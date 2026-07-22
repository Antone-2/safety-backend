import { z } from "zod";
export const UserRoleSchema = z.enum([
    "super-admin",
    "EHS-manager",
    "hse-officer",
    "she-committee-member",
    "supervisor",
    "gm",
    "plant-manager",
    "factory-manager",
    "depot-admin",
    "maintenance-manager",
    "issuer",
]);
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z
        .string()
        .min(12, "Password must be at least 12 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
        .optional(),
    name: z.string().min(1),
    role: UserRoleSchema.optional(),
    phone: z.string().min(3).max(30).optional(),
});
export const OtpRequestSchema = z.object({
    email: z.string().email(),
});
export const OtpVerifySchema = z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/, "OTP code must be 6 digits"),
});
