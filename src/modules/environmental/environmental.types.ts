import { z } from "zod";

export const WasteTypeSchema = z.enum(["Hazardous", "Non-Hazardous", "Recyclable", "Organic", "E-Waste", "Chemical"]);
export type WasteType = z.infer<typeof WasteTypeSchema>;

export const WasteStatusSchema = z.enum(["Stored", "Disposed", "Recycled", "Pending"]);
export type WasteStatus = z.infer<typeof WasteStatusSchema>;

export const EmissionTypeSchema = z.enum(["Air", "Water", "Noise", "Vibration"]);
export type EmissionType = z.infer<typeof EmissionTypeSchema>;

export const EmissionStatusSchema = z.enum(["Within Limit", "Exceedance", "Under Investigation"]);
export type EmissionStatus = z.infer<typeof EmissionStatusSchema>;

export const SpillSeveritySchema = z.enum(["Minor", "Major", "Critical"]);
export type SpillSeverity = z.infer<typeof SpillSeveritySchema>;

export interface WasteRecord {
  id: string;
  type: WasteType;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  generatedDate: string;
  storedLocation: string;
  disposedDate?: string;
  disposalMethod?: string;
  disposalContractor?: string;
  manifestNumber?: string;
  status: WasteStatus;
  photoUrl?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateWasteSchema = z
  .object({
    type: WasteTypeSchema,
    category: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(20),
    generatedDate: z.string().min(1),
    storedLocation: z.string().min(1).max(200),
    disposedDate: z.string().optional(),
    disposalMethod: z.string().max(200).optional(),
    disposalContractor: z.string().max(200).optional(),
    manifestNumber: z.string().max(100).optional(),
    status: WasteStatusSchema.default("Stored"),
    photoUrl: z.string().optional(),
    notes: z.string().max(500).optional(),
    createdBy: z.string().min(1).max(200),
  })
  .refine(
    (data) => {
      if (!data.disposedDate) return true;
      const generatedDate = new Date(data.generatedDate);
      const disposedDate = new Date(data.disposedDate);
      return (
        !Number.isNaN(generatedDate.getTime()) &&
        !Number.isNaN(disposedDate.getTime()) &&
        disposedDate >= generatedDate
      );
    },
    {
      message: "Disposed date must be the same as or after the generated date",
      path: ["disposedDate"],
    },
  )
  .refine(
    (data) =>
      !["Disposed", "Recycled"].includes(data.status) || Boolean(data.disposedDate?.trim()),
    {
      message: "Disposed date is required when waste status is Disposed or Recycled",
      path: ["disposedDate"],
    },
  );
export type CreateWasteInput = z.infer<typeof CreateWasteSchema>;

export const UpdateWasteSchema = z.object({
  type: WasteTypeSchema.optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(20).optional(),
  generatedDate: z.string().min(1).optional(),
  storedLocation: z.string().min(1).max(200).optional(),
  disposedDate: z.string().optional().nullable(),
  disposalMethod: z.string().max(200).optional().nullable(),
  disposalContractor: z.string().max(200).optional().nullable(),
  manifestNumber: z.string().max(100).optional().nullable(),
  status: WasteStatusSchema.optional(),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateWasteInput = z.infer<typeof UpdateWasteSchema>;

export interface Emission {
  id: string;
  type: EmissionType;
  parameter: string;
  location: string;
  value: number;
  unit: string;
  limit?: number;
  monitoredDate: string;
  monitoredBy: string;
  equipment?: string;
  correctiveAction?: string;
  status: EmissionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateEmissionSchema = z.object({
  type: EmissionTypeSchema,
  parameter: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().min(1).max(20),
  limit: z.number().optional(),
  monitoredDate: z.string().min(1),
  monitoredBy: z.string().min(1).max(200),
  equipment: z.string().max(200).optional(),
  correctiveAction: z.string().max(1000).optional(),
  status: EmissionStatusSchema.default("Within Limit"),
  createdBy: z.string().min(1).max(200),
});
export type CreateEmissionInput = z.infer<typeof CreateEmissionSchema>;

export const UpdateEmissionSchema = z.object({
  type: EmissionTypeSchema.optional(),
  parameter: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(200).optional(),
  value: z.number().optional(),
  unit: z.string().min(1).max(20).optional(),
  limit: z.number().optional().nullable(),
  monitoredDate: z.string().min(1).optional(),
  monitoredBy: z.string().min(1).max(200).optional(),
  equipment: z.string().max(200).optional().nullable(),
  correctiveAction: z.string().max(1000).optional().nullable(),
  status: EmissionStatusSchema.optional(),
});
export type UpdateEmissionInput = z.infer<typeof UpdateEmissionSchema>;

export interface Chemical {
  id: string;
  name: string;
  casNumber?: string;
  formula?: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  hazardClass?: string;
  sdsUrl?: string;
  expiryDate?: string;
  supplier?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateChemicalSchema = z.object({
  name: z.string().min(1).max(200),
  casNumber: z.string().max(50).optional(),
  formula: z.string().max(100).optional(),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  storageLocation: z.string().min(1).max(200),
  hazardClass: z.string().max(100).optional(),
  sdsUrl: z.string().optional(),
  expiryDate: z.string().optional(),
  supplier: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateChemicalInput = z.infer<typeof CreateChemicalSchema>;

export const UpdateChemicalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  casNumber: z.string().max(50).optional().nullable(),
  formula: z.string().max(100).optional().nullable(),
  quantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(20).optional(),
  storageLocation: z.string().min(1).max(200).optional(),
  hazardClass: z.string().max(100).optional().nullable(),
  sdsUrl: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateChemicalInput = z.infer<typeof UpdateChemicalSchema>;

export interface Spill {
  id: string;
  chemical: string;
  quantity: number;
  unit: string;
  location: string;
  date: string;
  time: string;
  severity: SpillSeverity;
  affectedArea?: string;
  responseActions?: string;
  cleanupCompleted: boolean;
  cleanupDate?: string;
  reportedToNema: boolean;
  nemaReportDate?: string;
  photoUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateSpillSchema = z.object({
  chemical: z.string().min(1).max(200),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  location: z.string().min(1).max(200),
  date: z.string().min(1),
  time: z.string().min(1),
  severity: SpillSeveritySchema,
  affectedArea: z.string().max(500).optional(),
  responseActions: z.string().max(2000).optional(),
  cleanupCompleted: z.boolean().default(false),
  cleanupDate: z.string().optional(),
  reportedToNema: z.boolean().default(false),
  nemaReportDate: z.string().optional(),
  photoUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateSpillInput = z.infer<typeof CreateSpillSchema>;

export const UpdateSpillSchema = z.object({
  chemical: z.string().min(1).max(200).optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(20).optional(),
  location: z.string().min(1).max(200).optional(),
  date: z.string().min(1).optional(),
  time: z.string().min(1).optional(),
  severity: SpillSeveritySchema.optional(),
  affectedArea: z.string().max(500).optional().nullable(),
  responseActions: z.string().max(2000).optional().nullable(),
  cleanupCompleted: z.boolean().optional(),
  cleanupDate: z.string().optional().nullable(),
  reportedToNema: z.boolean().optional(),
  nemaReportDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});
export type UpdateSpillInput = z.infer<typeof UpdateSpillSchema>;

export interface EnvironmentalStats {
  totalWaste: number;
  hazardousWaste: number;
  totalEmissions: number;
  exceedances: number;
  totalChemicals: number;
  totalSpills: number;
  majorSpills: number;
}
