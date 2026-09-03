import type { AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { assignmentsRepository } from "./assignments.repository.js";
import { type AssignmentRecord, type AssignmentTransitionInput } from "./assignments.types.js";
type CreateAssignmentInput = {
    reportId: string;
    assigneeEmail: string;
    assigneeName?: string;
    copiedEmails: string[];
    backupEmail?: string;
    reviewerEmail?: string;
    verifierEmail?: string;
    priority: string;
    reason: string;
    responseDueAt?: string;
    dueAt?: string;
    verificationDueAt?: string;
    templateId?: string;
    idempotencyKey?: string;
};
type BulkAssignmentInput = {
    reportIds: string[];
    assigneeEmail: string;
    copiedEmails: string[];
    priority: "Low" | "Medium" | "High" | "Critical";
    reason: string;
    dueAt?: string;
    templateId?: string;
    idempotencyKey?: string;
};
type BulkAssignmentResult = {
    succeeded: number;
    failed: number;
    results: Array<{
        reportId: string;
        assignment?: AssignmentRecord;
        error?: string;
    }>;
};
export declare class AssignmentsService {
    private idempotent;
    private getActorScope;
    private assertReportScope;
    private assertAccess;
    create(input: CreateAssignmentInput, req: AuthRequest): Promise<AssignmentRecord>;
    private createInternal;
    private notifyAssignmentEvent;
    list(filters: Parameters<typeof assignmentsRepository.list>[0], req: AuthRequest): Promise<AssignmentRecord[]>;
    get(id: string, req: AuthRequest): Promise<AssignmentRecord | null>;
    timeline(id: string, req?: AuthRequest): Promise<any[]>;
    syncReportAssignment(input: {
        reportId: string;
        assigneeEmail: string;
        copiedEmails: string[];
        reason?: string;
        dueAt?: string;
        priority?: "Low" | "Medium" | "High" | "Critical";
    }, req: AuthRequest): Promise<AssignmentRecord>;
    enqueueReportAssignmentSync(input: {
        reportId: string;
        assigneeEmail: string;
        copiedEmails: string[];
        reason?: string;
        dueAt?: string;
        priority?: "Low" | "Medium" | "High" | "Critical";
    }, req: AuthRequest, error?: unknown): Promise<any>;
    processReportAssignmentSync(limit?: number): Promise<{
        id: any;
        status: string;
    }[]>;
    enforceRetention(limit?: number): Promise<{
        archived: number;
    }>;
    workload(req?: AuthRequest): Promise<any[]>;
    bulkCreate(input: BulkAssignmentInput, req: AuthRequest): Promise<BulkAssignmentResult>;
    private bulkCreateInternal;
    recommendations(reportId: string, req: AuthRequest): Promise<{
        score: number;
        openAssignments: number;
        overdueAssignments: number;
        criticalAssignments: number;
        siteMatch: boolean;
        departmentMatch: boolean;
        sameTypeAssignments: number;
        onTimeRate: number | null;
        rationale: string;
        id: string;
        name: string;
        email: string;
        phone?: string;
        role: string;
    }[]>;
    createTemplate(input: Record<string, unknown>, req: AuthRequest): Promise<any>;
    listTemplates(): Promise<any[]>;
    createRoutingRule(input: {
        name: string;
        reportType?: string;
        severity?: string;
        site?: string;
        department?: string;
        assigneeEmail: string;
        copiedEmails: string[];
        templateId?: string;
        priority?: "Low" | "Medium" | "High" | "Critical";
        ruleOrder: number;
        active: boolean;
    }, req: AuthRequest): Promise<any>;
    listRoutingRules(): Promise<any[]>;
    processAutoAssignmentRules(limit?: number): Promise<({
        reportId: any;
        assignmentId: string;
        status: string;
        error?: undefined;
    } | {
        reportId: any;
        status: string;
        error: string;
        assignmentId?: undefined;
    })[]>;
    getNotificationPreferences(req: AuthRequest): Promise<any>;
    updateNotificationPreferences(input: Record<string, unknown>, req: AuthRequest): Promise<any>;
    createEscalationPolicy(input: Record<string, unknown>, req: AuthRequest): Promise<any>;
    listEscalationPolicies(): Promise<any[]>;
    addEffectivenessReview(assignmentId: string, input: {
        outcome: string;
        effectivenessScore: number;
        residualRisk: string;
        recurrenceDetected: boolean;
        followUpInspectionRequired: boolean;
        followUpDueAt?: string;
        notes: string;
    }, req: AuthRequest): Promise<any>;
    listEffectivenessReviews(assignmentId: string, req?: AuthRequest): Promise<any[]>;
    sign(assignmentId: string, input: {
        signatureType: string;
        declaration: string;
        expectedVersion: number;
    }, req: AuthRequest): Promise<any>;
    verifySignatures(assignmentId: string, req: AuthRequest): Promise<{
        assignmentId: string;
        valid: boolean;
        configured: boolean;
        signatures: {
            id: any;
            type: any;
            signer: any;
            signedAt: any;
            algorithm: any;
            verified: boolean;
        }[];
    }>;
    verifyAuditChain(assignmentId: string, req: AuthRequest): Promise<{
        assignmentId: string;
        valid: boolean;
        historicalSeal: boolean;
        verifiedEvents: number;
        issues: string[];
    }>;
    placeLegalHold(assignmentId: string, reason: string, req: AuthRequest): Promise<any>;
    releaseLegalHold(assignmentId: string, holdId: string, req: AuthRequest): Promise<any>;
    createRetentionPolicy(input: {
        name: string;
        site?: string;
        severity?: string;
        retentionYears: number;
    }, req: AuthRequest): Promise<any>;
    listRetentionPolicies(): Promise<any[]>;
    listLegalHolds(assignmentId: string, req: AuthRequest): Promise<any[]>;
    caseFile(assignmentId: string, req: AuthRequest): Promise<{
        caseFileHash: string;
        generatedAt: string;
        generatedBy: string | undefined;
        assignment: any;
        participants: any[];
        tasks: any[];
        evidence: any[];
        comments: any[];
        events: any[];
        effectivenessReviews: any[];
        signatures: any[];
        legalHolds: any[];
    }>;
    analytics(req: AuthRequest): Promise<{
        summary: any;
        statuses: any[];
        owners: any[];
        trend: any[];
        effectiveness: any[];
    }>;
    updateDeadlines(id: string, input: {
        responseDueAt?: string | null;
        dueAt?: string | null;
        verificationDueAt?: string | null;
        reason: string;
        expectedVersion: number;
    }, req: AuthRequest): Promise<AssignmentRecord>;
    transition(id: string, event: AssignmentTransitionInput, reason: string | undefined, expectedVersion: number | undefined, req: AuthRequest): Promise<AssignmentRecord>;
    reassign(id: string, input: {
        assigneeEmail: string;
        assigneeName?: string;
        reason: string;
        keepPreviousAsCopied: boolean;
        expectedVersion?: number;
    }, req: AuthRequest): Promise<AssignmentRecord>;
    delegate(id: string, input: {
        delegateEmail: string;
        delegateName?: string;
        reason: string;
        dueAt?: string;
    }, req: AuthRequest): Promise<AssignmentRecord | null>;
    addTask(assignmentId: string, input: {
        parentTaskId?: string;
        title: string;
        description?: string;
        ownerEmail: string;
        ownerName?: string;
        milestone: boolean;
        estimatedMinutes?: number;
        dueAt?: string;
        dependsOnTaskIds: string[];
    }, req: AuthRequest): Promise<any>;
    listTasks(assignmentId: string, req?: AuthRequest): Promise<any[]>;
    updateTask(assignmentId: string, taskId: string, input: {
        status?: string;
        percentComplete?: number;
        dueAt?: string | null;
        description?: string;
        reason?: string;
    }, req: AuthRequest): Promise<any>;
    setTaskDependencies(assignmentId: string, taskId: string, input: {
        dependsOnTaskIds: string[];
        reason: string;
    }, req: AuthRequest): Promise<any>;
    addComment(assignmentId: string, input: {
        parentCommentId?: string;
        body: string;
        visibility: "shared" | "internal";
        mentions: string[];
    }, req: AuthRequest): Promise<any>;
    listComments(assignmentId: string, req: AuthRequest): Promise<any[]>;
    editComment(assignmentId: string, commentId: string, input: {
        body: string;
        reason: string;
    }, req: AuthRequest): Promise<any>;
    commentRevisions(assignmentId: string, commentId: string, req: AuthRequest): Promise<any[]>;
    addEvidence(assignmentId: string, input: {
        taskId?: string;
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        fileSize?: number;
        checksum: string;
        description?: string;
        evidenceType: string;
    }, req: AuthRequest): Promise<any>;
    listEvidence(assignmentId: string, req?: AuthRequest): Promise<any[]>;
    reviewEvidence(assignmentId: string, evidenceId: string, input: {
        status: "Accepted" | "Rejected";
        notes?: string;
    }, req: AuthRequest): Promise<any>;
    setWatcher(assignmentId: string, input: {
        email: string;
        name?: string;
    }, active: boolean, req: AuthRequest): Promise<void>;
    private event;
}
export declare const assignmentsService: AssignmentsService;
export declare function startAssignmentSyncScheduler(): NodeJS.Timeout;
export {};
