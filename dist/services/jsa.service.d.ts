import { BaseService } from "./base.service.js";
import { z } from "zod";
export declare const JsaStatusSchema: z.ZodEnum<["draft", "in-review", "active", "completed", "archived"]>;
export type JsaStatus = z.infer<typeof JsaStatusSchema>;
export declare const JsaStepSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    hazards: z.ZodArray<z.ZodString, "many">;
    controls: z.ZodArray<z.ZodString, "many">;
    existingRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    residualRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    hazards: string[];
    controls: string[];
    existingRisk: "Critical" | "Low" | "Medium" | "High";
    residualRisk: "Critical" | "Low" | "Medium" | "High";
}, {
    id: string;
    description: string;
    hazards: string[];
    controls: string[];
    existingRisk: "Critical" | "Low" | "Medium" | "High";
    residualRisk: "Critical" | "Low" | "Medium" | "High";
}>;
export declare const JsaSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodString;
    department: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "in-review", "active", "completed", "archived"]>>;
    steps: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        hazards: z.ZodArray<z.ZodString, "many">;
        controls: z.ZodArray<z.ZodString, "many">;
        existingRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
        residualRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
        residualRisk: "Critical" | "Low" | "Medium" | "High";
    }, {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
        residualRisk: "Critical" | "Low" | "Medium" | "High";
    }>, "many">>>;
    createdBy: z.ZodString;
    reviewedBy: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "completed" | "in-review" | "archived";
    title: string;
    department: string;
    createdBy: string;
    location: string;
    steps: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
        residualRisk: "Critical" | "Low" | "Medium" | "High";
    }[];
    id?: string | undefined;
    description?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
}, {
    title: string;
    department: string;
    createdBy: string;
    location: string;
    status?: "active" | "draft" | "completed" | "in-review" | "archived" | undefined;
    id?: string | undefined;
    description?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
    steps?: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
        residualRisk: "Critical" | "Low" | "Medium" | "High";
    }[] | undefined;
}>;
export type JsaInput = z.infer<typeof JsaSchema>;
export declare class JsaService extends BaseService {
    constructor();
    createJsa(data: JsaInput): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    getJsaList(filters?: Record<string, any>): Promise<({
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null)[]>;
    getJsaById(id: string): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    updateJsa(id: string, data: Record<string, any>): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    deleteJsa(id: string): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    }>;
    submitForReview(id: string): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    approveJsa(id: string, reviewedBy: string): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    archiveJsa(id: string): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
    addStep(id: string, step: z.infer<typeof JsaStepSchema>): Promise<{
        id: string;
        title: string;
        description: string | undefined;
        location: string;
        department: string;
        status: JsaStatus;
        steps: {
            id: string;
            description: string;
            hazards: string[];
            controls: string[];
            existingRisk: "Critical" | "Low" | "Medium" | "High";
            residualRisk: "Critical" | "Low" | "Medium" | "High";
        }[];
        createdBy: string;
        reviewedBy: {} | undefined;
        reviewedAt: {} | undefined;
        createdAt: string;
        updatedAt: string;
    } | null>;
}
