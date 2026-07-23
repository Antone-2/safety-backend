import { z } from "zod";

export const ContractorStatusSchema = z.enum(["Active", "Suspended", "Blacklisted", "Expired"]);
export type ContractorStatus = z.infer<typeof ContractorStatusSchema>;

export const IncidentSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export interface Contractor {
  id: string;
  companyName: string;
  registrationNumber: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  physicalAddress?: string;
  services?: string;
  certifications?: string;
  insuranceExpiry?: string;
  safetyRating?: number;
  incidents: number;
  lastAuditDate?: string;
  status: ContractorStatus;
  inductionDate?: string;
  inductionExpiry?: string;
  documents?: string[];
  performanceScore?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateContractorSchema = z
  .object({
    companyName: z.string().min(1).max(200),
    registrationNumber: z.string().min(1).max(100),
    contactPerson: z.string().min(1).max(200),
    contactEmail: z.string().email().max(200),
    contactPhone: z.string().max(20),
    physicalAddress: z.string().max(500).optional(),
    services: z.string().max(1000).optional(),
    certifications: z.string().max(1000).optional(),
    insuranceExpiry: z.string().optional(),
    safetyRating: z.number().min(0).max(5).optional(),
    lastAuditDate: z.string().optional(),
    status: ContractorStatusSchema.default("Active"),
    inductionDate: z.string().optional(),
    inductionExpiry: z.string().optional(),
    documents: z.array(z.string()).optional().default([]),
    performanceScore: z.number().min(0).max(100).optional(),
    createdBy: z.string().min(1).max(200),
  })
  .refine(
    (data) => {
      if (!data.inductionDate || !data.inductionExpiry) return true;
      const inductionDate = new Date(data.inductionDate);
      const inductionExpiry = new Date(data.inductionExpiry);
      return (
        !Number.isNaN(inductionDate.getTime()) &&
        !Number.isNaN(inductionExpiry.getTime()) &&
        inductionExpiry >= inductionDate
      );
    },
    {
      message: "Induction expiry must be the same as or after the induction date",
      path: ["inductionExpiry"],
    },
  );
export type CreateContractorInput = z.infer<typeof CreateContractorSchema>;

export const UpdateContractorSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  registrationNumber: z.string().min(1).max(100).optional(),
  contactPerson: z.string().min(1).max(200).optional(),
  contactEmail: z.string().email().max(200).optional(),
  contactPhone: z.string().max(20).optional().nullable(),
  physicalAddress: z.string().max(500).optional().nullable(),
  services: z.string().max(1000).optional().nullable(),
  certifications: z.string().max(1000).optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  safetyRating: z.number().min(0).max(5).optional().nullable(),
  incidents: z.number().optional(),
  lastAuditDate: z.string().optional().nullable(),
  status: ContractorStatusSchema.optional(),
  inductionDate: z.string().optional().nullable(),
  inductionExpiry: z.string().optional().nullable(),
  documents: z.array(z.string()).optional().nullable(),
  performanceScore: z.number().min(0).max(100).optional().nullable(),
});
export type UpdateContractorInput = z.infer<typeof UpdateContractorSchema>;

export interface ContractorIncident {
  id: string;
  contractorId: string;
  incidentType: string;
  description: string;
  severity: IncidentSeverity;
  date: string;
  location: string;
  actionTaken?: string;
  followUpRequired: boolean;
  createdBy: string;
  createdAt: string;
}

export const CreateContractorIncidentSchema = z.object({
  contractorId: z.string().min(1).max(100),
  incidentType: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  severity: IncidentSeveritySchema,
  date: z.string().min(1),
  location: z.string().min(1).max(200),
  actionTaken: z.string().max(2000).optional(),
  followUpRequired: z.boolean().default(false),
  createdBy: z.string().min(1).max(200),
});
export type CreateContractorIncidentInput = z.infer<typeof CreateContractorIncidentSchema>;

export interface ContractorStats {
  total: number;
  active: number;
  suspended: number;
  blacklisted: number;
  avgRating: string;
}
