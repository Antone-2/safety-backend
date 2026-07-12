import { z } from "zod";
export interface IEmailTransport {
    send(to: string, subject: string, html: string): Promise<void>;
    sendBulk(to: string[], subject: string, html: string): Promise<void>;
}
export declare const EmailSchema: z.ZodObject<{
    to: z.ZodString;
    subject: z.ZodString;
    html: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
    subject: string;
    html: string;
}, {
    to: string;
    subject: string;
    html: string;
}>;
export type EmailInput = z.infer<typeof EmailSchema>;
