import { z } from "zod";
export declare const InvestigationStatusSchema: z.ZodEnum<["Pending", "In Progress", "Completed", "Closed"]>;
export declare const InvestigationPrioritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;
export type InvestigationPriority = z.infer<typeof InvestigationPrioritySchema>;
export declare const InvestigationEvidenceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    uploadedAt: z.ZodString;
    uploadedBy: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    uploadedAt: string;
    uploadedBy: string;
    type?: string | undefined;
    id?: string | undefined;
    url?: string | undefined;
    description?: string | undefined;
}, {
    name: string;
    uploadedAt: string;
    uploadedBy: string;
    type?: string | undefined;
    id?: string | undefined;
    url?: string | undefined;
    description?: string | undefined;
}>;
export declare const InvestigationSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    investigationNo: z.ZodOptional<z.ZodString>;
    incidentId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    investigator: z.ZodString;
    investigationTeam: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["Pending", "In Progress", "Completed", "Closed"]>>;
    priority: z.ZodDefault<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    evidence: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        uploadedAt: z.ZodString;
        uploadedBy: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        uploadedAt: string;
        uploadedBy: string;
        type?: string | undefined;
        id?: string | undefined;
        url?: string | undefined;
        description?: string | undefined;
    }, {
        name: string;
        uploadedAt: string;
        uploadedBy: string;
        type?: string | undefined;
        id?: string | undefined;
        url?: string | undefined;
        description?: string | undefined;
    }>, "many">>>;
    rootCause: z.ZodOptional<z.ZodString>;
    contributingFactors: z.ZodOptional<z.ZodString>;
    correctiveActions: z.ZodOptional<z.ZodString>;
    preventiveActions: z.ZodOptional<z.ZodString>;
    findings: z.ZodOptional<z.ZodString>;
    recommendations: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    completedDate: z.ZodOptional<z.ZodString>;
    reviewedBy: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodString>;
    incidentForm: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "Completed" | "Closed" | "In Progress" | "Pending";
    title: string;
    description: string;
    priority: "Critical" | "Low" | "Medium" | "High";
    createdBy: string;
    evidence: {
        name: string;
        uploadedAt: string;
        uploadedBy: string;
        type?: string | undefined;
        id?: string | undefined;
        url?: string | undefined;
        description?: string | undefined;
    }[];
    incidentId: string;
    investigator: string;
    id?: string | undefined;
    dueDate?: string | undefined;
    rootCause?: string | undefined;
    completedDate?: string | undefined;
    findings?: string | undefined;
    investigationNo?: string | undefined;
    investigationTeam?: string | undefined;
    contributingFactors?: string | undefined;
    correctiveActions?: string | undefined;
    preventiveActions?: string | undefined;
    recommendations?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
    incidentForm?: string | undefined;
}, {
    title: string;
    description: string;
    createdBy: string;
    incidentId: string;
    investigator: string;
    status?: "Completed" | "Closed" | "In Progress" | "Pending" | undefined;
    id?: string | undefined;
    dueDate?: string | undefined;
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    rootCause?: string | undefined;
    evidence?: {
        name: string;
        uploadedAt: string;
        uploadedBy: string;
        type?: string | undefined;
        id?: string | undefined;
        url?: string | undefined;
        description?: string | undefined;
    }[] | undefined;
    completedDate?: string | undefined;
    findings?: string | undefined;
    investigationNo?: string | undefined;
    investigationTeam?: string | undefined;
    contributingFactors?: string | undefined;
    correctiveActions?: string | undefined;
    preventiveActions?: string | undefined;
    recommendations?: string | undefined;
    reviewedBy?: string | undefined;
    reviewedAt?: string | undefined;
    incidentForm?: string | undefined;
}>;
export type InvestigationInput = z.infer<typeof InvestigationSchema>;
type InvestigationRecord = InvestigationInput & {
    id: string;
    createdAt: string;
    updatedAt: string;
};
export declare class InvestigationService {
    private validate;
    getAll(filters?: Record<string, any>): Promise<InvestigationRecord[]>;
    getById(id: string): Promise<InvestigationRecord | null>;
    createInvestigation(data: InvestigationInput): Promise<InvestigationRecord>;
    getByIncidentId(incidentId: string): Promise<InvestigationRecord[]>;
    getByStatus(status: string): Promise<InvestigationRecord[]>;
    getByPriority(priority: string): Promise<InvestigationRecord[]>;
    addEvidence(id: string, evidence: {
        name: string;
        url?: string;
        uploadedBy: string;
        type?: string;
        description?: string;
    }): Promise<InvestigationRecord | null>;
    completeInvestigation(id: string, data: {
        rootCause?: string;
        findings?: string;
        recommendations?: string;
        reviewedBy?: string;
    }): Promise<InvestigationRecord | null>;
    update(id: string, data: Record<string, any>): Promise<InvestigationRecord | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<{
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        closed: number;
        critical: number;
    }>;
}
export {};
