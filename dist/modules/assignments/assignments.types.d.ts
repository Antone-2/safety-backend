import { z } from "zod";
export declare const AssignmentStatusSchema: z.ZodEnum<["Draft", "Assigned", "Viewed", "Accepted", "In Progress", "Paused", "Submitted", "Under Review", "Rework", "Approved", "Verified", "Closed", "Rejected", "Cancelled"]>;
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;
export declare const AssignmentPrioritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export declare const AssignmentParticipantRoleSchema: z.ZodEnum<["assignee", "backup", "delegate", "copied", "watcher", "reviewer", "verifier"]>;
export declare const CreateAssignmentSchema: z.ZodObject<{
    reportId: z.ZodString;
    assigneeEmail: z.ZodString;
    assigneeName: z.ZodOptional<z.ZodString>;
    copiedEmails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    backupEmail: z.ZodOptional<z.ZodString>;
    reviewerEmail: z.ZodOptional<z.ZodString>;
    verifierEmail: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    reason: z.ZodString;
    responseDueAt: z.ZodOptional<z.ZodString>;
    dueAt: z.ZodOptional<z.ZodString>;
    verificationDueAt: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reportId: string;
    priority: "Critical" | "Low" | "Medium" | "High";
    assigneeEmail: string;
    copiedEmails: string[];
    reason: string;
    dueAt?: string | undefined;
    assigneeName?: string | undefined;
    backupEmail?: string | undefined;
    reviewerEmail?: string | undefined;
    verifierEmail?: string | undefined;
    responseDueAt?: string | undefined;
    verificationDueAt?: string | undefined;
    templateId?: string | undefined;
    idempotencyKey?: string | undefined;
}, {
    reportId: string;
    assigneeEmail: string;
    reason: string;
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    dueAt?: string | undefined;
    assigneeName?: string | undefined;
    copiedEmails?: string[] | undefined;
    backupEmail?: string | undefined;
    reviewerEmail?: string | undefined;
    verifierEmail?: string | undefined;
    responseDueAt?: string | undefined;
    verificationDueAt?: string | undefined;
    templateId?: string | undefined;
    idempotencyKey?: string | undefined;
}>;
export declare const AssignmentTransitionSchema: z.ZodObject<{
    event: z.ZodEnum<["view", "accept", "reject", "start", "pause", "resume", "submit", "review", "request-rework", "approve", "verify", "close", "reopen", "cancel"]>;
    reason: z.ZodOptional<z.ZodString>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    event: "close" | "pause" | "resume" | "accept" | "verify" | "review" | "view" | "reject" | "start" | "submit" | "request-rework" | "approve" | "reopen" | "cancel";
    reason?: string | undefined;
    expectedVersion?: number | undefined;
}, {
    event: "close" | "pause" | "resume" | "accept" | "verify" | "review" | "view" | "reject" | "start" | "submit" | "request-rework" | "approve" | "reopen" | "cancel";
    reason?: string | undefined;
    expectedVersion?: number | undefined;
}>;
export declare const ReassignAssignmentSchema: z.ZodObject<{
    assigneeEmail: z.ZodString;
    assigneeName: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    keepPreviousAsCopied: z.ZodDefault<z.ZodBoolean>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    assigneeEmail: string;
    reason: string;
    keepPreviousAsCopied: boolean;
    assigneeName?: string | undefined;
    expectedVersion?: number | undefined;
}, {
    assigneeEmail: string;
    reason: string;
    assigneeName?: string | undefined;
    expectedVersion?: number | undefined;
    keepPreviousAsCopied?: boolean | undefined;
}>;
export declare const DelegateAssignmentSchema: z.ZodObject<{
    delegateEmail: z.ZodString;
    delegateName: z.ZodOptional<z.ZodString>;
    reason: z.ZodString;
    dueAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    delegateEmail: string;
    dueAt?: string | undefined;
    delegateName?: string | undefined;
}, {
    reason: string;
    delegateEmail: string;
    dueAt?: string | undefined;
    delegateName?: string | undefined;
}>;
export declare const AssignmentTaskSchema: z.ZodObject<{
    parentTaskId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    ownerEmail: z.ZodString;
    ownerName: z.ZodOptional<z.ZodString>;
    milestone: z.ZodDefault<z.ZodBoolean>;
    estimatedMinutes: z.ZodOptional<z.ZodNumber>;
    dueAt: z.ZodOptional<z.ZodString>;
    dependsOnTaskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    ownerEmail: string;
    milestone: boolean;
    dependsOnTaskIds: string[];
    description?: string | undefined;
    dueAt?: string | undefined;
    parentTaskId?: string | undefined;
    ownerName?: string | undefined;
    estimatedMinutes?: number | undefined;
}, {
    title: string;
    ownerEmail: string;
    description?: string | undefined;
    dueAt?: string | undefined;
    parentTaskId?: string | undefined;
    ownerName?: string | undefined;
    milestone?: boolean | undefined;
    estimatedMinutes?: number | undefined;
    dependsOnTaskIds?: string[] | undefined;
}>;
export declare const AssignmentTaskUpdateSchema: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["Planned", "Assigned", "In Progress", "Blocked", "Completed", "Verified", "Cancelled"]>>;
    percentComplete: z.ZodOptional<z.ZodNumber>;
    dueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "Planned" | "In Progress" | "Completed" | "Blocked" | "Assigned" | "Verified" | "Cancelled" | undefined;
    description?: string | undefined;
    dueAt?: string | null | undefined;
    reason?: string | undefined;
    percentComplete?: number | undefined;
}, {
    status?: "Planned" | "In Progress" | "Completed" | "Blocked" | "Assigned" | "Verified" | "Cancelled" | undefined;
    description?: string | undefined;
    dueAt?: string | null | undefined;
    reason?: string | undefined;
    percentComplete?: number | undefined;
}>, {
    status?: "Planned" | "In Progress" | "Completed" | "Blocked" | "Assigned" | "Verified" | "Cancelled" | undefined;
    description?: string | undefined;
    dueAt?: string | null | undefined;
    reason?: string | undefined;
    percentComplete?: number | undefined;
}, {
    status?: "Planned" | "In Progress" | "Completed" | "Blocked" | "Assigned" | "Verified" | "Cancelled" | undefined;
    description?: string | undefined;
    dueAt?: string | null | undefined;
    reason?: string | undefined;
    percentComplete?: number | undefined;
}>;
export declare const AssignmentTaskDependenciesSchema: z.ZodObject<{
    dependsOnTaskIds: z.ZodArray<z.ZodString, "many">;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    dependsOnTaskIds: string[];
}, {
    reason: string;
    dependsOnTaskIds: string[];
}>;
export declare const AssignmentCommentSchema: z.ZodObject<{
    parentCommentId: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    visibility: z.ZodDefault<z.ZodEnum<["shared", "internal"]>>;
    mentions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    body: string;
    visibility: "internal" | "shared";
    mentions: string[];
    parentCommentId?: string | undefined;
}, {
    body: string;
    parentCommentId?: string | undefined;
    visibility?: "internal" | "shared" | undefined;
    mentions?: string[] | undefined;
}>;
export declare const AssignmentEvidenceSchema: z.ZodObject<{
    taskId: z.ZodOptional<z.ZodString>;
    fileName: z.ZodString;
    fileUrl: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    fileSize: z.ZodOptional<z.ZodNumber>;
    checksum: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    evidenceType: z.ZodDefault<z.ZodEnum<["Before Photo", "After Photo", "Document", "Certificate", "Inspection", "Work Order", "Video", "Other"]>>;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    fileUrl: string;
    checksum: string;
    evidenceType: "Before Photo" | "After Photo" | "Document" | "Certificate" | "Inspection" | "Work Order" | "Video" | "Other";
    description?: string | undefined;
    taskId?: string | undefined;
    mimeType?: string | undefined;
    fileSize?: number | undefined;
}, {
    fileName: string;
    fileUrl: string;
    checksum: string;
    description?: string | undefined;
    taskId?: string | undefined;
    mimeType?: string | undefined;
    fileSize?: number | undefined;
    evidenceType?: "Before Photo" | "After Photo" | "Document" | "Certificate" | "Inspection" | "Work Order" | "Video" | "Other" | undefined;
}>;
export declare const AssignmentEvidenceReviewSchema: z.ZodEffects<z.ZodObject<{
    status: z.ZodEnum<["Accepted", "Rejected"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "Accepted" | "Rejected";
    notes?: string | undefined;
}, {
    status: "Accepted" | "Rejected";
    notes?: string | undefined;
}>, {
    status: "Accepted" | "Rejected";
    notes?: string | undefined;
}, {
    status: "Accepted" | "Rejected";
    notes?: string | undefined;
}>;
export declare const AssignmentWatcherSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    name?: string | undefined;
}, {
    email: string;
    name?: string | undefined;
}>;
export declare const BulkAssignmentSchema: z.ZodObject<{
    reportIds: z.ZodArray<z.ZodString, "many">;
    assigneeEmail: z.ZodString;
    copiedEmails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    priority: z.ZodDefault<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    reason: z.ZodString;
    dueAt: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    priority: "Critical" | "Low" | "Medium" | "High";
    assigneeEmail: string;
    copiedEmails: string[];
    reason: string;
    reportIds: string[];
    dueAt?: string | undefined;
    templateId?: string | undefined;
    idempotencyKey?: string | undefined;
}, {
    assigneeEmail: string;
    reason: string;
    reportIds: string[];
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    dueAt?: string | undefined;
    copiedEmails?: string[] | undefined;
    templateId?: string | undefined;
    idempotencyKey?: string | undefined;
}>;
export declare const AssignmentTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    supersedesTemplateId: z.ZodOptional<z.ZodString>;
    reportType: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    defaultPriority: z.ZodDefault<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    responseSlaHours: z.ZodOptional<z.ZodNumber>;
    completionSlaHours: z.ZodOptional<z.ZodNumber>;
    verificationSlaHours: z.ZodOptional<z.ZodNumber>;
    defaultAssigneeRole: z.ZodOptional<z.ZodString>;
    defaultReviewerEmail: z.ZodOptional<z.ZodString>;
    defaultVerifierEmail: z.ZodOptional<z.ZodString>;
    taskBlueprint: z.ZodDefault<z.ZodArray<z.ZodObject<Omit<{
        parentTaskId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        ownerEmail: z.ZodString;
        ownerName: z.ZodOptional<z.ZodString>;
        milestone: z.ZodDefault<z.ZodBoolean>;
        estimatedMinutes: z.ZodOptional<z.ZodNumber>;
        dueAt: z.ZodOptional<z.ZodString>;
        dependsOnTaskIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "parentTaskId" | "dependsOnTaskIds">, "strip", z.ZodTypeAny, {
        title: string;
        ownerEmail: string;
        milestone: boolean;
        description?: string | undefined;
        dueAt?: string | undefined;
        ownerName?: string | undefined;
        estimatedMinutes?: number | undefined;
    }, {
        title: string;
        ownerEmail: string;
        description?: string | undefined;
        dueAt?: string | undefined;
        ownerName?: string | undefined;
        milestone?: boolean | undefined;
        estimatedMinutes?: number | undefined;
    }>, "many">>;
    evidenceRequirements: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    defaultPriority: "Critical" | "Low" | "Medium" | "High";
    taskBlueprint: {
        title: string;
        ownerEmail: string;
        milestone: boolean;
        description?: string | undefined;
        dueAt?: string | undefined;
        ownerName?: string | undefined;
        estimatedMinutes?: number | undefined;
    }[];
    evidenceRequirements: string[];
    site?: string | undefined;
    department?: string | undefined;
    reportType?: string | undefined;
    description?: string | undefined;
    supersedesTemplateId?: string | undefined;
    severity?: string | undefined;
    responseSlaHours?: number | undefined;
    completionSlaHours?: number | undefined;
    verificationSlaHours?: number | undefined;
    defaultAssigneeRole?: string | undefined;
    defaultReviewerEmail?: string | undefined;
    defaultVerifierEmail?: string | undefined;
}, {
    name: string;
    site?: string | undefined;
    department?: string | undefined;
    reportType?: string | undefined;
    description?: string | undefined;
    supersedesTemplateId?: string | undefined;
    severity?: string | undefined;
    defaultPriority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    responseSlaHours?: number | undefined;
    completionSlaHours?: number | undefined;
    verificationSlaHours?: number | undefined;
    defaultAssigneeRole?: string | undefined;
    defaultReviewerEmail?: string | undefined;
    defaultVerifierEmail?: string | undefined;
    taskBlueprint?: {
        title: string;
        ownerEmail: string;
        description?: string | undefined;
        dueAt?: string | undefined;
        ownerName?: string | undefined;
        milestone?: boolean | undefined;
        estimatedMinutes?: number | undefined;
    }[] | undefined;
    evidenceRequirements?: string[] | undefined;
}>;
export declare const AssignmentNotificationPreferenceSchema: z.ZodObject<{
    channels: z.ZodArray<z.ZodEnum<["email", "sms", "whatsapp", "in-app", "teams"]>, "many">;
    assignmentEvents: z.ZodArray<z.ZodEnum<["assigned", "due-soon", "overdue", "review", "rework", "escalated"]>, "many">;
    digestCadence: z.ZodEnum<["immediate", "daily", "weekly"]>;
    quietHoursStart: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quietHoursEnd: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timezone: z.ZodDefault<z.ZodString>;
    criticalBypassQuietHours: z.ZodDefault<z.ZodBoolean>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    teamsRecipient: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
    assignmentEvents: ("assigned" | "due-soon" | "overdue" | "review" | "rework" | "escalated")[];
    digestCadence: "daily" | "immediate" | "weekly";
    timezone: string;
    criticalBypassQuietHours: boolean;
    phone?: string | null | undefined;
    quietHoursStart?: string | null | undefined;
    quietHoursEnd?: string | null | undefined;
    teamsRecipient?: string | null | undefined;
}, {
    channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
    assignmentEvents: ("assigned" | "due-soon" | "overdue" | "review" | "rework" | "escalated")[];
    digestCadence: "daily" | "immediate" | "weekly";
    phone?: string | null | undefined;
    quietHoursStart?: string | null | undefined;
    quietHoursEnd?: string | null | undefined;
    timezone?: string | undefined;
    criticalBypassQuietHours?: boolean | undefined;
    teamsRecipient?: string | null | undefined;
}>;
export declare const EscalationPolicySchema: z.ZodObject<{
    name: z.ZodString;
    severity: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    responseSlaHours: z.ZodNumber;
    completionSlaHours: z.ZodNumber;
    levels: z.ZodArray<z.ZodObject<{
        afterHours: z.ZodNumber;
        recipients: z.ZodArray<z.ZodEnum<["assignee", "assigner", "copied", "reviewer", "verifier"]>, "many">;
        channels: z.ZodArray<z.ZodEnum<["email", "sms", "whatsapp", "in-app", "teams"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        recipients: ("assigner" | "copied" | "assignee" | "reviewer" | "verifier")[];
        channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
        afterHours: number;
    }, {
        recipients: ("assigner" | "copied" | "assignee" | "reviewer" | "verifier")[];
        channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
        afterHours: number;
    }>, "many">;
    businessCalendar: z.ZodObject<{
        workingDays: z.ZodArray<z.ZodNumber, "many">;
        startHour: z.ZodNumber;
        endHour: z.ZodNumber;
        holidays: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timezone: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        workingDays: number[];
        startHour: number;
        endHour: number;
        holidays: string[];
    }, {
        workingDays: number[];
        startHour: number;
        endHour: number;
        timezone?: string | undefined;
        holidays?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    levels: {
        recipients: ("assigner" | "copied" | "assignee" | "reviewer" | "verifier")[];
        channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
        afterHours: number;
    }[];
    responseSlaHours: number;
    completionSlaHours: number;
    businessCalendar: {
        timezone: string;
        workingDays: number[];
        startHour: number;
        endHour: number;
        holidays: string[];
    };
    site?: string | undefined;
    severity?: string | undefined;
}, {
    name: string;
    levels: {
        recipients: ("assigner" | "copied" | "assignee" | "reviewer" | "verifier")[];
        channels: ("email" | "sms" | "whatsapp" | "in-app" | "teams")[];
        afterHours: number;
    }[];
    responseSlaHours: number;
    completionSlaHours: number;
    businessCalendar: {
        workingDays: number[];
        startHour: number;
        endHour: number;
        timezone?: string | undefined;
        holidays?: string[] | undefined;
    };
    site?: string | undefined;
    severity?: string | undefined;
}>;
export declare const AssignmentCommentEditSchema: z.ZodObject<{
    body: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    body: string;
}, {
    reason: string;
    body: string;
}>;
export declare const EffectivenessReviewSchema: z.ZodEffects<z.ZodObject<{
    outcome: z.ZodEnum<["Effective", "Partially Effective", "Ineffective"]>;
    effectivenessScore: z.ZodNumber;
    residualRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    recurrenceDetected: z.ZodDefault<z.ZodBoolean>;
    followUpInspectionRequired: z.ZodDefault<z.ZodBoolean>;
    followUpDueAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodString;
}, "strip", z.ZodTypeAny, {
    notes: string;
    outcome: "Effective" | "Partially Effective" | "Ineffective";
    effectivenessScore: number;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    recurrenceDetected: boolean;
    followUpInspectionRequired: boolean;
    followUpDueAt?: string | undefined;
}, {
    notes: string;
    outcome: "Effective" | "Partially Effective" | "Ineffective";
    effectivenessScore: number;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    recurrenceDetected?: boolean | undefined;
    followUpInspectionRequired?: boolean | undefined;
    followUpDueAt?: string | undefined;
}>, {
    notes: string;
    outcome: "Effective" | "Partially Effective" | "Ineffective";
    effectivenessScore: number;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    recurrenceDetected: boolean;
    followUpInspectionRequired: boolean;
    followUpDueAt?: string | undefined;
}, {
    notes: string;
    outcome: "Effective" | "Partially Effective" | "Ineffective";
    effectivenessScore: number;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    recurrenceDetected?: boolean | undefined;
    followUpInspectionRequired?: boolean | undefined;
    followUpDueAt?: string | undefined;
}>;
export declare const AssignmentSignatureSchema: z.ZodObject<{
    signatureType: z.ZodEnum<["submission", "approval", "verification", "closure", "reopening"]>;
    declaration: z.ZodString;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    expectedVersion: number;
    signatureType: "submission" | "approval" | "verification" | "closure" | "reopening";
    declaration: string;
}, {
    expectedVersion: number;
    signatureType: "submission" | "approval" | "verification" | "closure" | "reopening";
    declaration: string;
}>;
export declare const AssignmentLegalHoldSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare const AssignmentDeadlineSchema: z.ZodEffects<z.ZodObject<{
    responseDueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    verificationDueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    reason: string;
    expectedVersion: number;
    dueAt?: string | null | undefined;
    responseDueAt?: string | null | undefined;
    verificationDueAt?: string | null | undefined;
}, {
    reason: string;
    expectedVersion: number;
    dueAt?: string | null | undefined;
    responseDueAt?: string | null | undefined;
    verificationDueAt?: string | null | undefined;
}>, {
    reason: string;
    expectedVersion: number;
    dueAt?: string | null | undefined;
    responseDueAt?: string | null | undefined;
    verificationDueAt?: string | null | undefined;
}, {
    reason: string;
    expectedVersion: number;
    dueAt?: string | null | undefined;
    responseDueAt?: string | null | undefined;
    verificationDueAt?: string | null | undefined;
}>;
export declare const AssignmentRetentionPolicySchema: z.ZodObject<{
    name: z.ZodString;
    site: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodString>;
    retentionYears: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    retentionYears: number;
    site?: string | undefined;
    severity?: string | undefined;
}, {
    name: string;
    retentionYears: number;
    site?: string | undefined;
    severity?: string | undefined;
}>;
export declare const AssignmentRoutingRuleSchema: z.ZodObject<{
    name: z.ZodString;
    reportType: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    assigneeEmail: z.ZodString;
    copiedEmails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    templateId: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
    ruleOrder: z.ZodDefault<z.ZodNumber>;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    active: boolean;
    assigneeEmail: string;
    copiedEmails: string[];
    ruleOrder: number;
    site?: string | undefined;
    department?: string | undefined;
    reportType?: string | undefined;
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    templateId?: string | undefined;
    severity?: string | undefined;
}, {
    name: string;
    assigneeEmail: string;
    site?: string | undefined;
    department?: string | undefined;
    reportType?: string | undefined;
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    active?: boolean | undefined;
    copiedEmails?: string[] | undefined;
    templateId?: string | undefined;
    severity?: string | undefined;
    ruleOrder?: number | undefined;
}>;
export interface AssignmentRecord {
    id: string;
    reportId: string;
    status: AssignmentStatus;
    priority: z.infer<typeof AssignmentPrioritySchema>;
    assigneeId?: string;
    assigneeEmail: string;
    assigneeName?: string;
    assignedById?: string;
    assignedByEmail: string;
    assignedByName?: string;
    site?: string;
    department?: string;
    assignmentReason?: string;
    responseDueAt?: string;
    dueAt?: string;
    verificationDueAt?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export declare const ASSIGNMENT_TRANSITIONS: Record<string, Partial<Record<AssignmentTransitionInput, AssignmentStatus>>>;
export type AssignmentTransitionInput = z.infer<typeof AssignmentTransitionSchema>["event"];
