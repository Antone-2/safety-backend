import { z } from "zod";

import type { LoginInput, CreateUserInput, UserRole, AuthToken } from "./common.types.js";

export type { LoginInput, CreateUserInput, UserRole, AuthToken };

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
  password: z.string().min(6).optional(),
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
