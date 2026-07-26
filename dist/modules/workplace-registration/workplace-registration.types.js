import { z } from "zod";
export const WorkplaceValiditySchema = z.enum(["VALID", "EXPIRED", "UNKNOWN"]);
export const CreateWorkplaceRegistrationSchema = z.object({
    location: z.string().min(1).max(300),
    certificateNo: z.string().max(200).optional().default(""),
    dateOfIssue: z.string().optional().default(""),
    expiryDate: z.string().optional().default(""),
});
export const UpdateWorkplaceRegistrationSchema = z.object({
    location: z.string().min(1).max(300).optional(),
    certificateNo: z.string().max(200).optional(),
    dateOfIssue: z.string().optional(),
    expiryDate: z.string().optional(),
});
