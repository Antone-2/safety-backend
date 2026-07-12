import { z } from "zod";

export interface IEmailTransport {
  send(to: string, subject: string, html: string): Promise<void>;
  sendBulk(to: string[], subject: string, html: string): Promise<void>;
}

export const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
});

export type EmailInput = z.infer<typeof EmailSchema>;
