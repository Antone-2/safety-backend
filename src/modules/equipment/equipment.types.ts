import { z } from "zod";

export const EquipmentTypeSchema = z.enum([
  "Extinguisher",
  "Hydrant",
  "Alarm",
  "Sprinkler",
  "EmergencyLight",
  "FireDoor",
  "Detector",
  "PPE",
  "SafetyEquipment",
  "Monitoring",
]);
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

export const EquipmentStatusSchema = z.enum(["Operational", "Under Maintenance", "Retired", "Defective"]);
export type EquipmentStatus = z.infer<typeof EquipmentStatusSchema>;

export const InspectionTypeSchema = z.enum(["Routine", "After Use", "Annual", "Regulatory", "Special"]);
export type InspectionType = z.infer<typeof InspectionTypeSchema>;

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  category: string;
  assetTag: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  location: string;
  site: string;
  department: string;
  purchaseDate?: string;
  installationDate?: string;
  warrantyExpiry?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  inspectionFrequency?: string;
  status: EquipmentStatus;
  condition?: string;
  assignedTo?: string;
  notes?: string;
  photoUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateEquipmentSchema = z.object({
  name: z.string().min(1).max(200),
  type: EquipmentTypeSchema,
  category: z.string().min(1).max(100),
  assetTag: z.string().min(1).max(100),
  serialNumber: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  location: z.string().min(1).max(200),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  purchaseDate: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  lastInspectionDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  inspectionFrequency: z.string().max(50).optional(),
  status: EquipmentStatusSchema.default("Operational"),
  condition: z.string().max(100).optional(),
  assignedTo: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  photoUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateEquipmentInput = z.infer<typeof CreateEquipmentSchema>;

export const UpdateEquipmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: EquipmentTypeSchema.optional(),
  category: z.string().min(1).max(100).optional(),
  assetTag: z.string().min(1).max(100).optional(),
  serialNumber: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  location: z.string().min(1).max(200).optional(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  purchaseDate: z.string().optional().nullable(),
  installationDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  lastInspectionDate: z.string().optional().nullable(),
  nextInspectionDate: z.string().optional().nullable(),
  inspectionFrequency: z.string().max(50).optional().nullable(),
  status: EquipmentStatusSchema.optional(),
  condition: z.string().max(100).optional().nullable(),
  assignedTo: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});
export type UpdateEquipmentInput = z.infer<typeof UpdateEquipmentSchema>;

export interface EquipmentInspection {
  id: string;
  equipmentId: string;
  inspector: string;
  inspectionDate: string;
  inspectionType: InspectionType;
  findings?: string;
  defects?: string;
  actionRequired?: string;
  passed: boolean;
  nextInspectionDue: string;
  photoUrl?: string;
  createdBy: string;
  createdAt: string;
}

export const CreateEquipmentInspectionSchema = z.object({
  equipmentId: z.string().min(1).max(100),
  inspector: z.string().min(1).max(200),
  inspectionDate: z.string().min(1),
  inspectionType: InspectionTypeSchema,
  findings: z.string().max(2000).optional(),
  defects: z.string().max(1000).optional(),
  actionRequired: z.string().max(1000).optional(),
  passed: z.boolean(),
  nextInspectionDue: z.string().min(1),
  photoUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateEquipmentInspectionInput = z.infer<typeof CreateEquipmentInspectionSchema>;

export interface EquipmentStats {
  total: number;
  operational: number;
  maintenance: number;
  retired: number;
}
