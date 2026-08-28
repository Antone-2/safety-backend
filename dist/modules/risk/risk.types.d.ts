import { z } from "zod";
export declare const RiskLevelSchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export interface RiskMatrix {
    id: string;
    name: string;
    description?: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    levels: Array<{
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }>;
    isDefault: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface RiskRegister {
    id: string;
    title: string;
    location: string;
    department: string;
    activity: string;
    hazard: string;
    existingControls: string;
    likelihood: number;
    severity: number;
    riskRating: number;
    riskLevel: RiskLevel;
    additionalControls?: string;
    residualLikelihood?: number;
    residualSeverity?: number;
    residualRiskRating?: number;
    residualRiskLevel?: RiskLevel;
    reviewDate?: string;
    reviewedBy?: string;
    status: string;
    sourceKind?: "database" | "report-sync";
    readonly?: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface BowTie {
    id: string;
    title: string;
    topEvent: string;
    threats?: string;
    preventiveBarriers?: string;
    consequences?: string;
    recoveryBarriers?: string;
    location: string;
    department: string;
    createdBy: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export declare const CreateRiskMatrixSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    likelihoodScale: z.ZodRecord<z.ZodNumber, z.ZodString>;
    severityScale: z.ZodRecord<z.ZodNumber, z.ZodString>;
    levels: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        minLikelihood: z.ZodNumber;
        maxLikelihood: z.ZodNumber;
        minSeverity: z.ZodNumber;
        maxSeverity: z.ZodNumber;
        color: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }>, "many">;
    isDefault: z.ZodDefault<z.ZodBoolean>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
    isDefault: boolean;
    description?: string | undefined;
}, {
    name: string;
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
    description?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateRiskMatrixInput = z.infer<typeof CreateRiskMatrixSchema>;
export declare const CreateRiskRegisterSchema: z.ZodObject<{
    title: z.ZodString;
    location: z.ZodString;
    department: z.ZodString;
    activity: z.ZodString;
    hazard: z.ZodString;
    existingControls: z.ZodString;
    likelihood: z.ZodNumber;
    severity: z.ZodNumber;
    additionalControls: z.ZodOptional<z.ZodString>;
    residualLikelihood: z.ZodOptional<z.ZodNumber>;
    residualSeverity: z.ZodOptional<z.ZodNumber>;
    reviewDate: z.ZodOptional<z.ZodString>;
    reviewedBy: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    title: string;
    department: string;
    createdBy: string;
    severity: number;
    location: string;
    activity: string;
    hazard: string;
    existingControls: string;
    likelihood: number;
    reviewedBy?: string | undefined;
    reviewDate?: string | undefined;
    additionalControls?: string | undefined;
    residualLikelihood?: number | undefined;
    residualSeverity?: number | undefined;
}, {
    title: string;
    department: string;
    createdBy: string;
    severity: number;
    location: string;
    activity: string;
    hazard: string;
    existingControls: string;
    likelihood: number;
    status?: string | undefined;
    reviewedBy?: string | undefined;
    reviewDate?: string | undefined;
    additionalControls?: string | undefined;
    residualLikelihood?: number | undefined;
    residualSeverity?: number | undefined;
}>;
export type CreateRiskRegisterInput = z.infer<typeof CreateRiskRegisterSchema>;
export declare const UpdateRiskRegisterSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    location: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    department: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    activity: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hazard: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    existingControls: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    likelihood: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    severity: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    additionalControls: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    residualLikelihood: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    residualSeverity: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    reviewDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    reviewedBy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    title?: string | undefined;
    department?: string | undefined;
    severity?: number | undefined;
    location?: string | undefined;
    reviewedBy?: string | undefined;
    reviewDate?: string | undefined;
    activity?: string | undefined;
    hazard?: string | undefined;
    existingControls?: string | undefined;
    likelihood?: number | undefined;
    additionalControls?: string | undefined;
    residualLikelihood?: number | undefined;
    residualSeverity?: number | undefined;
}, {
    status?: string | undefined;
    title?: string | undefined;
    department?: string | undefined;
    severity?: number | undefined;
    location?: string | undefined;
    reviewedBy?: string | undefined;
    reviewDate?: string | undefined;
    activity?: string | undefined;
    hazard?: string | undefined;
    existingControls?: string | undefined;
    likelihood?: number | undefined;
    additionalControls?: string | undefined;
    residualLikelihood?: number | undefined;
    residualSeverity?: number | undefined;
}>;
export type UpdateRiskRegisterInput = z.infer<typeof UpdateRiskRegisterSchema>;
export declare const CreateBowTieSchema: z.ZodObject<{
    title: z.ZodString;
    topEvent: z.ZodString;
    threats: z.ZodOptional<z.ZodString>;
    preventiveBarriers: z.ZodOptional<z.ZodString>;
    consequences: z.ZodOptional<z.ZodString>;
    recoveryBarriers: z.ZodOptional<z.ZodString>;
    location: z.ZodString;
    department: z.ZodString;
    createdBy: z.ZodString;
    status: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: string;
    title: string;
    department: string;
    createdBy: string;
    location: string;
    topEvent: string;
    threats?: string | undefined;
    preventiveBarriers?: string | undefined;
    consequences?: string | undefined;
    recoveryBarriers?: string | undefined;
}, {
    title: string;
    department: string;
    createdBy: string;
    location: string;
    topEvent: string;
    status?: string | undefined;
    threats?: string | undefined;
    preventiveBarriers?: string | undefined;
    consequences?: string | undefined;
    recoveryBarriers?: string | undefined;
}>;
export type CreateBowTieInput = z.infer<typeof CreateBowTieSchema>;
export interface RiskDashboard {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
}
