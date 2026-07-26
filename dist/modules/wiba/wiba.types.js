import { z } from "zod";
export const WibaClaimStatusSchema = z.enum(["Open", "Closed", "Pending", "Unknown"]);
export const WibaClaimSchema = z.object({
    id: z.string(),
    claimNo: z.string().min(1).max(100),
    dateOfInjury: z.string().min(1),
    natureOfInjury: z.string().min(1).max(500),
    claimantName: z.string().min(1).max(200),
    status: WibaClaimStatusSchema.default("Open"),
    stage: z.string().max(500).default("None"),
    amountAwardedKes: z.number().nullable().optional(),
    companyClaimKes: z.number().nullable().optional(),
    outstandingDocuments: z.array(z.string().min(1)).default([]),
    remarks: z.string().max(4000).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
const WibaClaimInputBaseSchema = z.object({
    claimNo: z.string().min(1).max(100),
    dateOfInjury: z.string().min(1),
    natureOfInjury: z.string().min(1).max(500),
    claimantName: z.string().min(1).max(200),
    status: WibaClaimStatusSchema.default("Open"),
    stage: z.string().max(500).default("None"),
    amountAwardedKes: z.number().nullable().optional(),
    companyClaimKes: z.number().nullable().optional(),
    outstandingDocuments: z.array(z.string().min(1)).default([]),
    remarks: z.string().max(4000).optional(),
});
export const WibaClaimInputSchema = WibaClaimInputBaseSchema;
export const WibaClaimPatchSchema = WibaClaimInputBaseSchema.partial();
