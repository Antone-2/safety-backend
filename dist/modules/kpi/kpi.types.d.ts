import { z } from "zod";
export type KpiDirection = "higher_is_better" | "lower_is_better";
export interface KpiDefinition {
    id: string;
    name: string;
    description?: string;
    category: string;
    unit: string;
    targetValue: number;
    direction: KpiDirection;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface KpiValue {
    id: string;
    definitionId: string;
    periodStart: string;
    periodEnd: string;
    actualValue: number;
    notes?: string;
    recordedBy: string;
    recordedAt: string;
    createdAt: string;
    updatedAt: string;
}
export declare const KpiDirectionSchema: z.ZodEnum<["higher_is_better", "lower_is_better"]>;
export declare const CreateKpiDefinitionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    unit: z.ZodString;
    targetValue: z.ZodNumber;
    direction: z.ZodDefault<z.ZodEnum<["higher_is_better", "lower_is_better"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    createdBy: string;
    category: string;
    unit: string;
    targetValue: number;
    direction: "higher_is_better" | "lower_is_better";
    isActive: boolean;
    description?: string | undefined;
}, {
    name: string;
    createdBy: string;
    category: string;
    unit: string;
    targetValue: number;
    description?: string | undefined;
    direction?: "higher_is_better" | "lower_is_better" | undefined;
    isActive?: boolean | undefined;
}>;
export type CreateKpiDefinitionInput = z.infer<typeof CreateKpiDefinitionSchema>;
export declare const UpdateKpiDefinitionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    unit: z.ZodOptional<z.ZodString>;
    targetValue: z.ZodOptional<z.ZodNumber>;
    direction: z.ZodOptional<z.ZodEnum<["higher_is_better", "lower_is_better"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    category?: string | undefined;
    unit?: string | undefined;
    targetValue?: number | undefined;
    direction?: "higher_is_better" | "lower_is_better" | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    category?: string | undefined;
    unit?: string | undefined;
    targetValue?: number | undefined;
    direction?: "higher_is_better" | "lower_is_better" | undefined;
    isActive?: boolean | undefined;
}>;
export type UpdateKpiDefinitionInput = z.infer<typeof UpdateKpiDefinitionSchema>;
export declare const CreateKpiValueSchema: z.ZodObject<{
    definitionId: z.ZodString;
    periodStart: z.ZodString;
    periodEnd: z.ZodString;
    actualValue: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    recordedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    periodStart: string;
    periodEnd: string;
    definitionId: string;
    actualValue: number;
    recordedBy: string;
    notes?: string | undefined;
}, {
    periodStart: string;
    periodEnd: string;
    definitionId: string;
    actualValue: number;
    recordedBy: string;
    notes?: string | undefined;
}>;
export type CreateKpiValueInput = z.infer<typeof CreateKpiValueSchema>;
export declare const UpdateKpiValueSchema: z.ZodObject<{
    periodStart: z.ZodOptional<z.ZodString>;
    periodEnd: z.ZodOptional<z.ZodString>;
    actualValue: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    periodStart?: string | undefined;
    periodEnd?: string | undefined;
    actualValue?: number | undefined;
}, {
    notes?: string | undefined;
    periodStart?: string | undefined;
    periodEnd?: string | undefined;
    actualValue?: number | undefined;
}>;
export type UpdateKpiValueInput = z.infer<typeof UpdateKpiValueSchema>;
export interface KpiDashboardSummary {
    totalDefinitions: number;
    activeDefinitions: number;
    totalValues: number;
    categories: string[];
}
