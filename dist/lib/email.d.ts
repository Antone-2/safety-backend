import { z } from "zod";
export declare const TestEmailSchema: z.ZodObject<{
    to: z.ZodString;
    subject: z.ZodDefault<z.ZodString>;
    message: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    to: string;
    subject: string;
}, {
    to: string;
    message?: string | undefined;
    subject?: string | undefined;
}>;
export type TestEmailInput = z.infer<typeof TestEmailSchema>;
export declare const ReminderSchema: z.ZodObject<{
    to: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    capaId: z.ZodString;
    action: z.ZodString;
    dueDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
    capaId: string;
    action: string;
    dueDate: string;
    phone?: string | undefined;
}, {
    to: string;
    capaId: string;
    action: string;
    dueDate: string;
    phone?: string | undefined;
}>;
export type ReminderInput = z.infer<typeof ReminderSchema>;
export declare const CapaAssignmentNotificationSchema: z.ZodObject<{
    to: z.ZodString;
    role: z.ZodEnum<["owner", "backup", "escalation"]>;
    capaId: z.ZodString;
    title: z.ZodString;
    source: z.ZodString;
    actionPlan: z.ZodString;
    dueDate: z.ZodString;
    site: z.ZodString;
    department: z.ZodString;
    owner: z.ZodString;
    assignedBy: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    updateSummary: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "owner" | "backup" | "escalation";
    to: string;
    capaId: string;
    dueDate: string;
    owner: string;
    title: string;
    source: string;
    actionPlan: string;
    site: string;
    department: string;
    status?: string | undefined;
    assignedBy?: string | undefined;
    updateSummary?: string | undefined;
    url?: string | undefined;
}, {
    role: "owner" | "backup" | "escalation";
    to: string;
    capaId: string;
    dueDate: string;
    owner: string;
    title: string;
    source: string;
    actionPlan: string;
    site: string;
    department: string;
    status?: string | undefined;
    assignedBy?: string | undefined;
    updateSummary?: string | undefined;
    url?: string | undefined;
}>;
export type CapaAssignmentNotificationInput = z.infer<typeof CapaAssignmentNotificationSchema>;
export declare const CorrectiveActionRequestEmailSchema: z.ZodObject<{
    to: z.ZodString;
    recipientName: z.ZodOptional<z.ZodString>;
    reportId: z.ZodString;
    reportType: z.ZodString;
    description: z.ZodString;
    assigneeNote: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
    url: string;
    reportId: string;
    reportType: string;
    description: string;
    dueDate?: string | undefined;
    recipientName?: string | undefined;
    assigneeNote?: string | undefined;
}, {
    to: string;
    url: string;
    reportId: string;
    reportType: string;
    description: string;
    dueDate?: string | undefined;
    recipientName?: string | undefined;
    assigneeNote?: string | undefined;
}>;
export type CorrectiveActionRequestEmailInput = z.infer<typeof CorrectiveActionRequestEmailSchema>;
export declare const CorrectiveActionSubmissionNotificationSchema: z.ZodObject<{
    to: z.ZodString;
    reportId: z.ZodString;
    recipientName: z.ZodOptional<z.ZodString>;
    recipientEmail: z.ZodString;
    dueDate: z.ZodOptional<z.ZodString>;
    actionPlanDueDate: z.ZodOptional<z.ZodString>;
    actionPlanSummary: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    reportId: string;
    recipientEmail: string;
    actionPlanSummary: string;
    dueDate?: string | undefined;
    url?: string | undefined;
    recipientName?: string | undefined;
    actionPlanDueDate?: string | undefined;
}, {
    to: string;
    reportId: string;
    recipientEmail: string;
    actionPlanSummary: string;
    dueDate?: string | undefined;
    url?: string | undefined;
    recipientName?: string | undefined;
    actionPlanDueDate?: string | undefined;
}>;
export type CorrectiveActionSubmissionNotificationInput = z.infer<typeof CorrectiveActionSubmissionNotificationSchema>;
export declare const CorrectiveActionReminderEmailSchema: z.ZodObject<{
    to: z.ZodString;
    reportId: z.ZodString;
    stage: z.ZodEnum<["request", "plan", "task"]>;
    dueDate: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    dueDate: string;
    title: string;
    reportId: string;
    stage: "request" | "plan" | "task";
    url?: string | undefined;
    description?: string | undefined;
}, {
    to: string;
    dueDate: string;
    title: string;
    reportId: string;
    stage: "request" | "plan" | "task";
    url?: string | undefined;
    description?: string | undefined;
}>;
export type CorrectiveActionReminderEmailInput = z.infer<typeof CorrectiveActionReminderEmailSchema>;
export declare const CorrectiveActionSupervisorUpdateEmailSchema: z.ZodObject<{
    to: z.ZodString;
    reportId: z.ZodString;
    recipientName: z.ZodOptional<z.ZodString>;
    supervisorName: z.ZodOptional<z.ZodString>;
    updateType: z.ZodEnum<["review-update", "comment"]>;
    summary: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    reportId: string;
    updateType: "review-update" | "comment";
    summary: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    supervisorName?: string | undefined;
}, {
    to: string;
    reportId: string;
    updateType: "review-update" | "comment";
    summary: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    supervisorName?: string | undefined;
}>;
export type CorrectiveActionSupervisorUpdateEmailInput = z.infer<typeof CorrectiveActionSupervisorUpdateEmailSchema>;
export declare const CorrectiveActionAcknowledgementEmailSchema: z.ZodObject<{
    to: z.ZodString;
    reportId: z.ZodString;
    recipientName: z.ZodOptional<z.ZodString>;
    acknowledgedBy: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    reportId: string;
    acknowledgedBy: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    note?: string | undefined;
}, {
    to: string;
    reportId: string;
    acknowledgedBy: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    note?: string | undefined;
}>;
export type CorrectiveActionAcknowledgementEmailInput = z.infer<typeof CorrectiveActionAcknowledgementEmailSchema>;
export declare const CorrectiveActionAcknowledgementReminderEmailSchema: z.ZodObject<{
    to: z.ZodString;
    reportId: z.ZodString;
    recipientName: z.ZodOptional<z.ZodString>;
    supervisorName: z.ZodOptional<z.ZodString>;
    reminderSummary: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    reportId: string;
    reminderSummary: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    supervisorName?: string | undefined;
}, {
    to: string;
    reportId: string;
    reminderSummary: string;
    url?: string | undefined;
    recipientName?: string | undefined;
    supervisorName?: string | undefined;
}>;
export type CorrectiveActionAcknowledgementReminderEmailInput = z.infer<typeof CorrectiveActionAcknowledgementReminderEmailSchema>;
export interface CapaAssignmentDeliveryResult {
    recipient: string;
    role: "owner" | "backup" | "escalation";
    subject: string;
    message: string;
    delivered: boolean;
    mode: "brevo" | "smtp" | "internal" | "failed";
    error?: string;
}
export declare function sendBrevoEmail(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}): Promise<void>;
export declare function sendOtpEmail(input: {
    to: string;
    code: string;
    expiresMinutes: number;
}): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
}>;
export declare function sendSms(to: string, body: string): Promise<boolean>;
export declare function sendSmsNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, phone: string): Promise<boolean>;
export declare function sendTestEmail(input: TestEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
}>;
export declare function sendCapaReminder(input: ReminderInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
}>;
export declare function buildIncidentNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, recipient: string): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildAssignmentNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, assignee: string): {
    recipient: string;
    subject: string;
    message: string;
};
export type AssignmentRecipientRole = "assigner" | "primary" | "secondary";
export interface AssignmentRecipient {
    email: string;
    name?: string;
    role: AssignmentRecipientRole;
}
export interface AssignmentDeliveryResult {
    recipient: string;
    role: AssignmentRecipientRole;
    subject: string;
    message: string;
    delivered: boolean;
    mode: "brevo" | "smtp" | "internal" | "failed";
    error?: string;
}
export declare function sendWhatsApp(to: string, body: string): Promise<boolean>;
export declare function buildReportAssignmentNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, recipient: AssignmentRecipient, assignedBy?: string, primaryRecipient?: string): {
    recipient: string;
    role: AssignmentRecipientRole;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionRequestNotification(input: CorrectiveActionRequestEmailInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionSubmissionNotification(input: CorrectiveActionSubmissionNotificationInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionReminderNotification(input: CorrectiveActionReminderEmailInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionSupervisorUpdateNotification(input: CorrectiveActionSupervisorUpdateEmailInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionAcknowledgementNotification(input: CorrectiveActionAcknowledgementEmailInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCorrectiveActionAcknowledgementReminderNotification(input: CorrectiveActionAcknowledgementReminderEmailInput): {
    recipient: string;
    subject: string;
    message: string;
};
export declare function buildCapaAssignmentNotification(input: CapaAssignmentNotificationInput): {
    recipient: string;
    role: "owner" | "backup" | "escalation";
    subject: string;
    message: string;
};
export declare function sendReportAssignmentNotifications(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, recipients: AssignmentRecipient[], assignedBy?: string, primaryRecipient?: string): Promise<AssignmentDeliveryResult[]>;
export declare function sendCorrectiveActionRequestEmail(input: CorrectiveActionRequestEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCorrectiveActionSubmissionNotification(input: CorrectiveActionSubmissionNotificationInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCorrectiveActionReminderEmail(input: CorrectiveActionReminderEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCorrectiveActionSupervisorUpdateEmail(input: CorrectiveActionSupervisorUpdateEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCorrectiveActionAcknowledgementEmail(input: CorrectiveActionAcknowledgementEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCorrectiveActionAcknowledgementReminderEmail(input: CorrectiveActionAcknowledgementReminderEmailInput): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendCapaAssignmentNotifications(inputs: CapaAssignmentNotificationInput[]): Promise<CapaAssignmentDeliveryResult[]>;
export declare function sendAssignmentNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, assignee: string): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
    recipient: string;
}>;
export declare function sendIncidentNotification(report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
}, recipient: string): Promise<{
    ok: boolean;
    delivered: boolean;
    mode: string;
    message: string;
}>;
