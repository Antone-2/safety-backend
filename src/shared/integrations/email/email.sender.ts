import nodemailer from "nodemailer";
import { getEnv } from "../../../config/index.js";
import type { IEmailTransport, EmailInput } from "./transporter.js";

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

export class SmtpEmailTransport implements IEmailTransport {
  async send(to: string, subject: string, html: string): Promise<void> {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: getEnv().SMTP_FROM,
      to,
      subject,
      html,
    });
  }

  async sendBulk(to: string[], subject: string, html: string): Promise<void> {
    await Promise.all(to.map((email) => this.send(email, subject, html)));
  }
}

export class EtherealEmailTransport implements IEmailTransport {
  async send(to: string, subject: string, html: string): Promise<void> {
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

  async sendBulk(_to: string[], _subject: string, _html: string): Promise<void> {
    await this.send(_to[0], _subject, _html);
  }
}

export function getEmailTransport(): IEmailTransport {
  const env = getEnv();
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) {
    return new SmtpEmailTransport();
  }
  return new EtherealEmailTransport();
}

export const emailTransport = getEmailTransport();
