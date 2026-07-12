import nodemailer from "nodemailer";
import { getEnv } from "../../../config/index.js";
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
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) {
        return new SmtpEmailTransport();
    }
    return new EtherealEmailTransport();
}
export const emailTransport = getEmailTransport();
