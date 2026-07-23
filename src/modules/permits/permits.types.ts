import { z } from "zod";

export const PermitTypeSchema = z.enum([
  "Hot Work",
  "Cold Work",
  "Confined Space",
  "Electrical",
  "Excavation",
  "Height Work",
  "General",
]);
export type PermitType = z.infer<typeof PermitTypeSchema>;

export const PermitStatusSchema = z.enum([
  "draft",
  "applicant",
  "supervisor",
  "ehs",
  "issuer",
  "approval",
  "active",
  "closed",
  "expired",
]);
export type PermitStatus = z.infer<typeof PermitStatusSchema>;

export interface PermitAttachment {
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PermitComment {
  author: string;
  at: string;
  text: string;
}

export interface Permit {
  id: string;
  type: PermitType;
  status: PermitStatus;
  location: string;
  applicant: string;
  applicantContact?: string;
  supervisor?: string;
  ehsOfficer?: string;
  issuer?: string;
  approver?: string;
  description: string;
  startDate: string;
  endDate: string;
  hazards?: string;
  precautions?: string;
  ppeRequired?: string[];
  isolationRequired?: boolean;
  isolationDetails?: string;
  fireWatchRequired?: boolean;
  gasTestRequired?: boolean;
  gasTestResult?: string;
  gasTestBefore?: string;
  gasTestAfter?: string;
  fireWatchAssigned?: string;
  attachments: PermitAttachment[];
  comments: PermitComment[];
  linkedJsaId?: string;
  linkedIncidentId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreatePermitSchema = z
  .object({
    type: PermitTypeSchema,
    location: z.string().min(1).max(200),
    applicant: z.string().min(1).max(200),
    applicantContact: z.string().max(50).optional(),
    supervisor: z.string().max(200).optional(),
    ehsOfficer: z.string().max(200).optional(),
    issuer: z.string().max(200).optional(),
    approver: z.string().max(200).optional(),
    description: z.string().min(1).max(5000),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    hazards: z.string().max(2000).optional(),
    precautions: z.string().max(2000).optional(),
    ppeRequired: z.array(z.string().max(100)).optional(),
    isolationRequired: z.boolean().optional().default(false),
    isolationDetails: z.string().max(2000).optional(),
    fireWatchRequired: z.boolean().optional().default(false),
    gasTestRequired: z.boolean().optional().default(false),
    gasTestResult: z.string().max(200).optional(),
    gasTestBefore: z.string().optional().nullable(),
    gasTestAfter: z.string().optional().nullable(),
    fireWatchAssigned: z.string().optional().nullable(),
    attachments: z.array(z.any()).optional().default([]),
    comments: z.array(z.any()).optional().default([]),
    linkedJsaId: z.string().optional(),
    linkedIncidentId: z.string().optional(),
    createdBy: z.string().min(1).max(200),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
    },
    {
      message: "Permit end date must be the same as or after the start date",
      path: ["endDate"],
    },
  );
export type CreatePermitInput = z.infer<typeof CreatePermitSchema>;

export const UpdatePermitSchema = z.object({
  type: PermitTypeSchema.optional(),
  location: z.string().min(1).max(200).optional(),
  applicant: z.string().min(1).max(200).optional(),
  applicantContact: z.string().max(50).optional().nullable(),
  supervisor: z.string().max(200).optional().nullable(),
  ehsOfficer: z.string().max(200).optional().nullable(),
  issuer: z.string().max(200).optional().nullable(),
  approver: z.string().max(200).optional().nullable(),
  description: z.string().min(1).max(5000).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  hazards: z.string().max(2000).optional().nullable(),
  precautions: z.string().max(2000).optional().nullable(),
  ppeRequired: z.array(z.string().max(100)).optional().nullable(),
  isolationRequired: z.boolean().optional(),
  isolationDetails: z.string().max(2000).optional().nullable(),
  fireWatchRequired: z.boolean().optional(),
  gasTestRequired: z.boolean().optional(),
  gasTestResult: z.string().max(200).optional().nullable(),
  gasTestBefore: z.string().optional().nullable(),
  gasTestAfter: z.string().optional().nullable(),
  fireWatchAssigned: z.string().optional().nullable(),
  status: PermitStatusSchema.optional(),
});
export type UpdatePermitInput = z.infer<typeof UpdatePermitSchema>;

export const AdvancePermitStatusSchema = z.object({
  status: PermitStatusSchema,
});
export type AdvancePermitStatusInput = z.infer<
  typeof AdvancePermitStatusSchema
>;

export const CreatePermitInputSchema = CreatePermitSchema;
export const UpdatePermitInputSchema = UpdatePermitSchema;
