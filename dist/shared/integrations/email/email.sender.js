import nodemailer from "nodemailer";
import { getEnv } from "../../../config/index.js";
const BREVO_TRANSACTIONAL_URL = "https://api.brevo.com/v3/smtp/email";
function createTransporter() {
    return nodemailer.createTransport({
        host: getEnv().SMTP_HOST,
        port: Number(getEnv().SMTP_PORT || 587),
        secure: getEnv().SMTP_SECURE === "true",
        auth: {
            user: getEnv().SMTP_USER,
            pass: getEnv().SMTP_PASS,
        },
    });
}
export class SmtpEmailTransport {
    async send(to, subject, html) {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: getEnv().SMTP_FROM,
            to,
            subject,
            html,
        });
    }
    async sendBulk(to, subject, html) {
        await Promise.all(to.map((email) => this.send(email, subject, html)));
    }
}
export class BrevoEmailTransport {
    async send(to, subject, html) {
        const env = getEnv();
        if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
            throw new Error("Brevo email transport is not configured");
        }
        const response = await fetch(BREVO_TRANSACTIONAL_URL, {
            method: "POST",
            headers: {
                accept: "application/json",
                "api-key": env.BREVO_API_KEY,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: env.BREVO_SENDER_NAME || "Crown Paints Safety",
                    email: env.BREVO_SENDER_EMAIL,
                },
                to: [{ email: to }],
                subject,
                htmlContent: html,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`Brevo email failed with HTTP ${response.status}: ${body}`);
        }
    }
    async sendBulk(to, subject, html) {
        await Promise.all(to.map((email) => this.send(email, subject, html)));
    }
}
export class EtherealEmailTransport {
    async send(to, subject, html) {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        await transporter.sendMail({
            from: testAccount.user,
            to,
            subject,
            html,
        });
    }
    async sendBulk(_to, _subject, _html) {
        await this.send(_to[0], _subject, _html);
    }
}
export function getEmailTransport() {
    const env = getEnv();
    if (env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL) {
        return new BrevoEmailTransport();
    }
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) {
        return new SmtpEmailTransport();
    }
    return new EtherealEmailTransport();
}
export const emailTransport = getEmailTransport();
