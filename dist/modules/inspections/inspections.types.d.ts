import { z } from "zod";
export declare const InspectionStatusSchema: z.ZodEnum<["Scheduled", "In Progress", "Completed", "Overdue", "Cancelled"]>;
export declare const InspectionFindingSeveritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type InspectionStatus = z.infer<typeof InspectionStatusSchema>;
export type InspectionFindingSeverity = z.infer<typeof InspectionFindingSeveritySchema>;
export interface InspectionTemplateItem {
    id: string;
    text: string;
    required: boolean;
}
export interface InspectionTemplate {
    id: string;
    title: string;
    area: string;
    frequency: string;
    site: string;
    department: string;
    checklist: InspectionTemplateItem[];
    active: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface InspectionFinding {
    id: string;
    inspectionId: string;
    checklistItemId?: string;
    observation: string;
    severity: InspectionFindingSeverity;
    actionOwner?: string;
    dueDate?: string;
    status: "Open" | "Closed";
    createdAt: string;
}
export interface InspectionRecord {
    id: string;
    templateId?: string;
    templateTitle?: string;
    title: string;
    inspectionDate: string;
    dueDate: string;
    status: InspectionStatus;
    inspector: string;
    site: string;
    department: string;
    area: string;
    assignedTo?: string;
    recurrence?: string;
    notes?: string;
    findings: InspectionFinding[];
    checklistCompletion: {
        total: number;
        completed: number;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface InspectionStats {
    totalTemplates: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    overdue: number;
    openFindings: number;
}
export declare const CreateInspectionTemplateSchema: z.ZodObject<{
    title: z.ZodString;
    area: z.ZodString;
    frequency: z.ZodString;
    site: z.ZodString;
    department: z.ZodString;
    checklist: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
        required: boolean;
    }, {
        id: string;
        text: string;
        required?: boolean | undefined;
    }>, "many">;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    site: string;
    department: string;
    active: boolean;
    createdBy: string;
    frequency: string;
    area: string;
    checklist: {
        id: string;
        text: string;
        required: boolean;
    }[];
}, {
    title: string;
    site: string;
    department: string;
    createdBy: string;
    frequency: string;
    area: string;
    checklist: {
        id: string;
        text: string;
        required?: boolean | undefined;
    }[];
    active?: boolean | undefined;
}>;
export type CreateInspectionTemplateInput = z.infer<typeof CreateInspectionTemplateSchema>;
export declare const UpdateInspectionTemplateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodString>;
    frequency: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    checklist: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
        required: boolean;
    }, {
        id: string;
        text: string;
        required?: boolean | undefined;
    }>, "many">>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    active?: boolean | undefined;
    frequency?: string | undefined;
    area?: string | undefined;
    checklist?: {
        id: string;
        text: string;
        required: boolean;
    }[] | undefined;
}, {
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    active?: boolean | undefined;
    frequency?: string | undefined;
    area?: string | undefined;
    checklist?: {
        id: string;
        text: string;
        required?: boolean | undefined;
    }[] | undefined;
}>;
export type UpdateInspectionTemplateInput = z.infer<typeof UpdateInspectionTemplateSchema>;
export declare const CreateInspectionFindingSchema: z.ZodObject<{
    checklistItemId: z.ZodOptional<z.ZodString>;
    observation: z.ZodString;
    severity: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    actionOwner: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["Open", "Closed"]>>;
}, "strip", z.ZodTypeAny, {
    status: "Closed" | "Open";
    severity: "Critical" | "Low" | "Medium" | "High";
    observation: string;
    dueDate?: string | undefined;
    actionOwner?: string | undefined;
    checklistItemId?: string | undefined;
}, {
    severity: "Critical" | "Low" | "Medium" | "High";
    observation: string;
    status?: "Closed" | "Open" | undefined;
    dueDate?: string | undefined;
    actionOwner?: string | undefined;
    checklistItemId?: string | undefined;
}>;
export type CreateInspectionFindingInput = z.infer<typeof CreateInspectionFindingSchema>;
export declare const CreateInspectionSchema: z.ZodObject<{
    templateId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    inspectionDate: z.ZodString;
    dueDate: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["Scheduled", "In Progress", "Completed", "Overdue", "Cancelled"]>>;
    inspector: z.ZodString;
    site: z.ZodString;
    department: z.ZodString;
    area: z.ZodString;
    assignedTo: z.ZodOptional<z.ZodString>;
    recurrence: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    findings: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        checklistItemId: z.ZodOptional<z.ZodString>;
        observation: z.ZodString;
        severity: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
        actionOwner: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<["Open", "Closed"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "Closed" | "Open";
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }, {
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        status?: "Closed" | "Open" | undefined;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }>, "many">>>;
    checklistCompletion: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        total: z.ZodDefault<z.ZodNumber>;
        completed: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        total: number;
        completed: number;
    }, {
        total?: number | undefined;
        completed?: number | undefined;
    }>>>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "In Progress" | "Completed" | "Overdue" | "Cancelled" | "Scheduled";
    dueDate: string;
    title: string;
    site: string;
    department: string;
    createdBy: string;
    findings: {
        status: "Closed" | "Open";
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }[];
    inspector: string;
    inspectionDate: string;
    area: string;
    checklistCompletion: {
        total: number;
        completed: number;
    };
    assignedTo?: string | undefined;
    notes?: string | undefined;
    templateId?: string | undefined;
    recurrence?: string | undefined;
}, {
    dueDate: string;
    title: string;
    site: string;
    department: string;
    createdBy: string;
    inspector: string;
    inspectionDate: string;
    area: string;
    status?: "In Progress" | "Completed" | "Overdue" | "Cancelled" | "Scheduled" | undefined;
    assignedTo?: string | undefined;
    notes?: string | undefined;
    findings?: {
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        status?: "Closed" | "Open" | undefined;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }[] | undefined;
    templateId?: string | undefined;
    recurrence?: string | undefined;
    checklistCompletion?: {
        total?: number | undefined;
        completed?: number | undefined;
    } | undefined;
}>;
export type CreateInspectionInput = z.infer<typeof CreateInspectionSchema>;
export declare const UpdateInspectionSchema: z.ZodObject<{
    templateId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodOptional<z.ZodString>;
    inspectionDate: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["Scheduled", "In Progress", "Completed", "Overdue", "Cancelled"]>>;
    inspector: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    area: z.ZodOptional<z.ZodString>;
    assignedTo: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    recurrence: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    findings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        checklistItemId: z.ZodOptional<z.ZodString>;
        observation: z.ZodString;
        severity: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
        actionOwner: z.ZodOptional<z.ZodString>;
        dueDate: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<["Open", "Closed"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "Closed" | "Open";
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }, {
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        status?: "Closed" | "Open" | undefined;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }>, "many">>;
    checklistCompletion: z.ZodOptional<z.ZodObject<{
        total: z.ZodNumber;
        completed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        completed: number;
    }, {
        total: number;
        completed: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status?: "In Progress" | "Completed" | "Overdue" | "Cancelled" | "Scheduled" | undefined;
    dueDate?: string | undefined;
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    assignedTo?: string | null | undefined;
    notes?: string | null | undefined;
    findings?: {
        status: "Closed" | "Open";
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }[] | undefined;
    inspector?: string | undefined;
    inspectionDate?: string | undefined;
    templateId?: string | null | undefined;
    area?: string | undefined;
    recurrence?: string | null | undefined;
    checklistCompletion?: {
        total: number;
        completed: number;
    } | undefined;
}, {
    status?: "In Progress" | "Completed" | "Overdue" | "Cancelled" | "Scheduled" | undefined;
    dueDate?: string | undefined;
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    assignedTo?: string | null | undefined;
    notes?: string | null | undefined;
    findings?: {
        severity: "Critical" | "Low" | "Medium" | "High";
        observation: string;
        status?: "Closed" | "Open" | undefined;
        dueDate?: string | undefined;
        actionOwner?: string | undefined;
        checklistItemId?: string | undefined;
    }[] | undefined;
    inspector?: string | undefined;
    inspectionDate?: string | undefined;
    templateId?: string | null | undefined;
    area?: string | undefined;
    recurrence?: string | null | undefined;
    checklistCompletion?: {
        total: number;
        completed: number;
    } | undefined;
}>;
export type UpdateInspectionInput = z.infer<typeof UpdateInspectionSchema>;
