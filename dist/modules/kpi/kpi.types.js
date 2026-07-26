import { z } from "zod";
export const KpiDirectionSchema = z.enum(["higher_is_better", "lower_is_better"]);
export const CreateKpiDefinitionSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    category: z.string().min(1).max(100),
    unit: z.string().min(1).max(50),
    targetValue: z.number().min(0),
    direction: KpiDirectionSchema.default("higher_is_better"),
    isActive: z.boolean().default(true),
    createdBy: z.string().min(1).max(200),
});
export const UpdateKpiDefinitionSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    category: z.string().min(1).max(100).optional(),
    unit: z.string().min(1).max(50).optional(),
    targetValue: z.number().min(0).optional(),
    direction: KpiDirectionSchema.optional(),
    isActive: z.boolean().optional(),
});
export const CreateKpiValueSchema = z.object({
    definitionId: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    actualValue: z.number().min(0),
    notes: z.string().max(2000).optional(),
    recordedBy: z.string().min(1).max(200),
});
export const UpdateKpiValueSchema = z.object({
    periodStart: z.string().min(1).optional(),
    periodEnd: z.string().min(1).optional(),
    actualValue: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
});
