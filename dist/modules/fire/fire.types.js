import { z } from "zod";
export const FireEquipmentTypeSchema = z.enum(["Extinguisher", "Hydrant", "Alarm", "Sprinkler", "EmergencyLight", "FireDoor", "Detector"]);
export const FireEquipmentStatusSchema = z.enum(["Operational", "Defective", "Under Maintenance", "Retired"]);
export const InspectionTypeSchema = z.enum(["Routine", "After Use", "Annual", "Regulatory", "Special"]);
export const CreateFireEquipmentSchema = z.object({
    type: FireEquipmentTypeSchema,
    location: z.string().min(1).max(200),
    building: z.string().min(1).max(100),
    floor: z.string().max(50).optional(),
    room: z.string().max(100).optional(),
    assetTag: z.string().min(1).max(100),
    manufacturer: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serialNumber: z.string().max(100).optional(),
    installationDate: z.string().optional(),
    lastInspectionDate: z.string().optional(),
    nextInspectionDate: z.string().optional(),
    inspectionFrequency: z.string().max(50).optional(),
    status: FireEquipmentStatusSchema.default("Operational"),
    notes: z.string().max(500).optional(),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export const UpdateFireEquipmentSchema = z.object({
    type: FireEquipmentTypeSchema.optional(),
    location: z.string().min(1).max(200).optional(),
    building: z.string().min(1).max(100).optional(),
    floor: z.string().max(50).optional().nullable(),
    room: z.string().max(100).optional().nullable(),
    assetTag: z.string().min(1).max(100).optional(),
    manufacturer: z.string().max(100).optional().nullable(),
    model: z.string().max(100).optional().nullable(),
    serialNumber: z.string().max(100).optional().nullable(),
    installationDate: z.string().optional().nullable(),
    lastInspectionDate: z.string().optional().nullable(),
    nextInspectionDate: z.string().optional().nullable(),
    inspectionFrequency: z.string().max(50).optional().nullable(),
    status: FireEquipmentStatusSchema.optional(),
    notes: z.string().max(500).optional().nullable(),
    photoUrl: z.string().optional().nullable(),
});
export const CreateFireInspectionSchema = z.object({
    equipmentId: z.string().min(1).max(100),
    inspector: z.string().min(1).max(200),
    inspectionDate: z.string().min(1),
    findings: z.string().max(2000).optional(),
    defects: z.string().max(1000).optional(),
    actionRequired: z.string().max(1000).optional(),
    passed: z.boolean(),
    nextInspectionDue: z.string().min(1),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
