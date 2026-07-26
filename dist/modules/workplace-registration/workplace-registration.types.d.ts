import { z } from "zod";
export declare const WorkplaceValiditySchema: z.ZodEnum<["VALID", "EXPIRED", "UNKNOWN"]>;
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
export declare const CreateWorkplaceRegistrationSchema: z.ZodObject<{
    location: z.ZodString;
    certificateNo: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    dateOfIssue: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    expiryDate: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    location: string;
    expiryDate: string;
    certificateNo: string;
    dateOfIssue: string;
}, {
    location: string;
    expiryDate?: string | undefined;
    certificateNo?: string | undefined;
    dateOfIssue?: string | undefined;
}>;
export type CreateWorkplaceRegistrationInput = z.infer<typeof CreateWorkplaceRegistrationSchema>;
export declare const UpdateWorkplaceRegistrationSchema: z.ZodObject<{
    location: z.ZodOptional<z.ZodString>;
    certificateNo: z.ZodOptional<z.ZodString>;
    dateOfIssue: z.ZodOptional<z.ZodString>;
    expiryDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    location?: string | undefined;
    expiryDate?: string | undefined;
    certificateNo?: string | undefined;
    dateOfIssue?: string | undefined;
}, {
    location?: string | undefined;
    expiryDate?: string | undefined;
    certificateNo?: string | undefined;
    dateOfIssue?: string | undefined;
}>;
export type UpdateWorkplaceRegistrationInput = z.infer<typeof UpdateWorkplaceRegistrationSchema>;
export interface WorkplaceRegistrationStats {
    total: number;
    valid: number;
    expired: number;
    unknown: number;
}
