import { z } from "zod";
import type { LoginInput, CreateUserInput, UserRole, AuthToken } from "./common.types.js";
export type { LoginInput, CreateUserInput, UserRole, AuthToken };
export declare const UserRoleSchema: z.ZodEnum<["super-admin", "EHS-manager", "hse-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer"]>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["super-admin", "EHS-manager", "hse-officer", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin", "maintenance-manager", "issuer"]>>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password?: string | undefined;
    role?: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | undefined;
    phone?: string | undefined;
}, {
    name: string;
    email: string;
    password?: string | undefined;
    role?: "super-admin" | "EHS-manager" | "hse-officer" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm" | "maintenance-manager" | "issuer" | undefined;
    phone?: string | undefined;
}>;
export declare const OtpRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const OtpVerifySchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    email: string;
}, {
    code: string;
    email: string;
}>;
