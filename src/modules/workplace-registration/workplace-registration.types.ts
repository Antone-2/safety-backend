import { z } from "zod";

export const WorkplaceValiditySchema = z.enum(["VALID", "EXPIRED", "UNKNOWN"]);
export type WorkplaceValidity = z.infer<typeof WorkplaceValiditySchema>;

export interface WorkplaceRegistration {
  id: string;
  location: string;
  certificateNo: string;
  dateOfIssue: string;
  expiryDate: string;
  validity: WorkplaceValidity;
  createdAt: string;
  updatedAt: string;
}

export const CreateWorkplaceRegistrationSchema = z.object({
  location: z.string().min(1).max(300),
  certificateNo: z.string().max(200).optional().default(""),
  dateOfIssue: z.string().optional().default(""),
  expiryDate: z.string().optional().default(""),
});
export type CreateWorkplaceRegistrationInput = z.infer<typeof CreateWorkplaceRegistrationSchema>;

export const UpdateWorkplaceRegistrationSchema = z.object({
  location: z.string().min(1).max(300).optional(),
  certificateNo: z.string().max(200).optional(),
  dateOfIssue: z.string().optional(),
  expiryDate: z.string().optional(),
});
export type UpdateWorkplaceRegistrationInput = z.infer<typeof UpdateWorkplaceRegistrationSchema>;

export interface WorkplaceRegistrationStats {
  total: number;
  valid: number;
  expired: number;
  unknown: number;
}

