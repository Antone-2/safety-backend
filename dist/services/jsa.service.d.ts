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
    existingRisk: "Low" | "Medium" | "High" | "Critical";
    residualRisk: "Low" | "Medium" | "High" | "Critical";
}, {
    id: string;
    description: string;
    hazards: string[];
    controls: string[];
    existingRisk: "Low" | "Medium" | "High" | "Critical";
    residualRisk: "Low" | "Medium" | "High" | "Critical";
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
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }, {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }>, "many">>>;
    createdBy: z.ZodString;
    reviewedBy: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "active" | "completed" | "in-review" | "archived";
    location: string;
    department: string;
    createdBy: string;
    title: string;
    steps: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }[];
    id?: string | undefined;
    description?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
}, {
    location: string;
    department: string;
    createdBy: string;
    title: string;
    status?: "draft" | "active" | "completed" | "in-review" | "archived" | undefined;
    id?: string | undefined;
    description?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
    steps?: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }[] | undefined;
}>;
export type JsaInput = z.infer<typeof JsaSchema>;
export declare class JsaService extends BaseService {
    constructor();
    createJsa(data: JsaInput): Promise<any>;
    getJsaList(filters?: Record<string, any>): Promise<any[]>;
    getJsaById(id: string): Promise<any>;
    updateJsa(id: string, data: Record<string, any>): Promise<any>;
    submitForReview(id: string): Promise<any>;
    approveJsa(id: string, reviewedBy: string): Promise<any>;
    archiveJsa(id: string): Promise<any>;
    addStep(id: string, step: z.infer<typeof JsaStepSchema>): Promise<any>;
}
