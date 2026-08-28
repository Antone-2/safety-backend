import { z } from "zod";
export const InspectionStatusSchema = z.enum([
    "Scheduled",
    "In Progress",
    "Completed",
    "Overdue",
    "Cancelled",
]);
export const InspectionFindingSeveritySchema = z.enum([
    "Low",
    "Medium",
    "High",
    "Critical",
]);
const ChecklistItemSchema = z.object({
    id: z.string().min(1).max(100),
    text: z.string().min(1).max(500),
    required: z.boolean().default(true),
});
export const CreateInspectionTemplateSchema = z.object({
    title: z.string().min(1).max(200),
    area: z.string().min(1).max(200),
    frequency: z.string().min(1).max(80),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    checklist: z.array(ChecklistItemSchema).min(1).max(100),
    active: z.boolean().optional().default(true),
    createdBy: z.string().min(1).max(200),
});
export const UpdateInspectionTemplateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    area: z.string().min(1).max(200).optional(),
    frequency: z.string().min(1).max(80).optional(),
    site: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    checklist: z.array(ChecklistItemSchema).min(1).max(100).optional(),
    active: z.boolean().optional(),
});
export const CreateInspectionFindingSchema = z.object({
    checklistItemId: z.string().min(1).max(100).optional(),
    observation: z.string().min(1).max(2000),
    severity: InspectionFindingSeveritySchema,
    actionOwner: z.string().max(200).optional(),
    dueDate: z.string().optional(),
    status: z.enum(["Open", "Closed"]).default("Open"),
});
export const CreateInspectionSchema = z.object({
    templateId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    inspectionDate: z.string().min(1),
    dueDate: z.string().min(1),
    status: InspectionStatusSchema.default("Scheduled"),
    inspector: z.string().min(1).max(200),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    area: z.string().min(1).max(200),
    assignedTo: z.string().max(200).optional(),
    recurrence: z.string().max(80).optional(),
    notes: z.string().max(4000).optional(),
    findings: z.array(CreateInspectionFindingSchema).optional().default([]),
    checklistCompletion: z
        .object({
        total: z.number().int().min(0).default(0),
        completed: z.number().int().min(0).default(0),
    })
        .optional()
        .default({ total: 0, completed: 0 }),
    createdBy: z.string().min(1).max(200),
});
export const UpdateInspectionSchema = z.object({
    templateId: z.string().uuid().optional().nullable(),
    title: z.string().min(1).max(200).optional(),
    inspectionDate: z.string().min(1).optional(),
    dueDate: z.string().min(1).optional(),
    status: InspectionStatusSchema.optional(),
    inspector: z.string().min(1).max(200).optional(),
    site: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    area: z.string().min(1).max(200).optional(),
    assignedTo: z.string().max(200).optional().nullable(),
    recurrence: z.string().max(80).optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
    findings: z.array(CreateInspectionFindingSchema).optional(),
    checklistCompletion: z
        .object({
        total: z.number().int().min(0),
        completed: z.number().int().min(0),
    })
        .optional(),
});
