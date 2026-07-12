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
