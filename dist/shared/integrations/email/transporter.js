import { z } from "zod";
export const EmailSchema = z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(200),
    html: z.string().min(1),
});
