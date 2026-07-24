export declare const CORRECTIVE_ACTION_EVENT_TYPES: readonly ["Unsafe Act", "Unsafe Condition", "Incident", "Accident"];
export declare const CORRECTIVE_ACTION_ITEM_STATUSES: readonly ["Planned", "In Progress", "Completed", "Blocked"];
export type CorrectiveActionEventType = (typeof CORRECTIVE_ACTION_EVENT_TYPES)[number];
export type CorrectiveActionItemStatus = (typeof CORRECTIVE_ACTION_ITEM_STATUSES)[number];
export interface CorrectiveActionPlanItem {
    action: string;
    byWho: string;
    byWhoEmail?: string;
    byWhen: string;
    status: CorrectiveActionItemStatus;
}
export interface CorrectiveActionRequestComment {
    id: string;
    authorName?: string;
    authorEmail?: string;
    text: string;
    createdAt: string;
}
export interface CorrectiveActionRequestRecord {
    id: string;
    reportId: string;
    accessToken: string;
    recipientEmail: string;
    recipientName?: string | null;
    assignedByEmail?: string | null;
    assignedByName?: string | null;
    reportType: string;
    reportCategory?: string | null;
    reportDescription: string;
    reportLocation?: string | null;
    reportDepartment?: string | null;
    assigneeNote?: string | null;
    copiedRecipientEmails: string[];
    priority: "Low" | "Medium" | "High" | "Critical";
    dueDate?: string | null;
    actionPlanDueDate?: string | null;
    status: "pending" | "submitted";
    unsafeEventType?: CorrectiveActionEventType | null;
    immediateActionTaken?: string | null;
    completedTasks?: string | null;
    rootCauseAnalysis?: string | null;
    actionPlanItems: CorrectiveActionPlanItem[];
    supervisorComments: CorrectiveActionRequestComment[];
    supervisorAcknowledgedAt?: string | null;
    supervisorAcknowledgedBy?: string | null;
    supervisorAcknowledgementNote?: string | null;
    capaId?: string | null;
    submittedAt?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export type CorrectiveActionNotificationRecipient = {
    recipient: string;
    role: "recipient" | "sender" | "copied" | "task-owner";
    stage: "request" | "submission" | "request-reminder" | "plan-reminder" | "task-reminder" | "review-update" | "comment" | "acknowledgement" | "acknowledgement-reminder";
    delivered: boolean;
    mode: "brevo" | "smtp" | "failed" | "internal";
    message?: string;
    error?: string;
};
export type CorrectiveActionNotificationHistoryEntry = {
    id: string;
    requestId: string;
    action: string;
    actorEmail?: string;
    actorRole?: string;
    createdAt: string;
    delivered: number;
    queued: number;
    failed: number;
    message: string;
    recipients: CorrectiveActionNotificationRecipient[];
};
export type CorrectiveActionRequestRecordWithHistory = CorrectiveActionRequestRecord & {
    notificationHistory: CorrectiveActionNotificationHistoryEntry[];
};
export type CorrectiveActionNotificationSummary = {
    delivered: number;
    queued: number;
    failed: number;
    message: string;
    recipients: CorrectiveActionNotificationRecipient[];
};
export declare function createCorrectiveActionRequest(input: {
    reportId: string;
    recipientEmail: string;
    recipientName?: string;
    assignedByEmail?: string;
    assignedByName?: string;
    copiedRecipientEmails?: string[];
    reportType: string;
    reportCategory?: string;
    reportDescription: string;
    reportLocation?: string;
    reportDepartment?: string;
    assigneeNote?: string;
    priority: "Low" | "Medium" | "High" | "Critical";
    dueDate?: string;
}): Promise<CorrectiveActionRequestRecord>;
export declare function listCorrectiveActionRequestsByReport(reportId: string): Promise<CorrectiveActionRequestRecordWithHistory[]>;
export declare function resendCorrectiveActionNotifications(input: {
    requestId: string;
    actor?: {
        id?: string;
        email?: string;
        role?: string;
    } | null;
}): Promise<{
    record: CorrectiveActionRequestRecord;
    notifications: CorrectiveActionNotificationSummary;
}>;
export declare function updateCorrectiveActionRequestReview(input: {
    requestId: string;
    actionPlanDueDate?: string | null;
    actionPlanItems: CorrectiveActionPlanItem[];
    actor?: {
        id?: string;
        email?: string;
        role?: string;
    } | null;
}): Promise<CorrectiveActionRequestRecord>;
export declare function addCorrectiveActionSupervisorComment(input: {
    requestId: string;
    text: string;
    actor?: {
        id?: string;
        email?: string;
        role?: string;
        name?: string;
    } | null;
}): Promise<CorrectiveActionRequestRecord>;
export declare function acknowledgeCorrectiveActionSupervisorFollowUp(input: {
    token: string;
    note?: string;
}): Promise<CorrectiveActionRequestRecord>;
export declare function sendCorrectiveActionAcknowledgementReminder(input: {
    requestId: string;
    actor?: {
        id?: string;
        email?: string;
        role?: string;
        name?: string;
    } | null;
}): Promise<CorrectiveActionNotificationSummary>;
export declare function getCorrectiveActionRequestByToken(token: string): Promise<CorrectiveActionRequestRecord | null>;
export declare function submitCorrectiveActionRequest(input: {
    token: string;
    unsafeEventType: CorrectiveActionEventType;
    description: string;
    immediateActionTaken: string;
    completedTasks: string;
    rootCauseAnalysis: string;
    actionPlanDueDate?: string;
    actionPlanItems: CorrectiveActionPlanItem[];
}): Promise<CorrectiveActionRequestRecord>;
export declare function sendCorrectiveActionReminders(daysBefore?: number): Promise<{
    sent: number;
}>;
export declare function startCorrectiveActionReminderScheduler(): NodeJS.Timeout;
