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
    action: string;
    dueDate: string;
    to: string;
    capaId: string;
    phone?: string | undefined;
}, {
    action: string;
    dueDate: string;
    to: string;
    capaId: string;
    phone?: string | undefined;
}>;
export type ReminderInput = z.infer<typeof ReminderSchema>;
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
