import nodemailer from "nodemailer";
import { z } from "zod";

export const TestEmailSchema = z.object({
  to: z.string().email(),
  subject: z
    .string()
    .min(1)
    .default("Crown Paints HSE email notification test"),
  message: z
    .string()
    .min(1)
    .default("This is a test email from the Crown Paints HSE system."),
});

export type TestEmailInput = z.infer<typeof TestEmailSchema>;

export const ReminderSchema = z.object({
  to: z.string().email(),
  phone: z.string().optional(),
  capaId: z.string(),
  action: z.string(),
  dueDate: z.string(),
});

export type ReminderInput = z.infer<typeof ReminderSchema>;

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM,
  );
}

function hasTwilioConfig() {
  return Boolean(
    process.env.TWILIO_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM,
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMailWithRetry(options: nodemailer.SendMailOptions, attempts = 3, delayMs = 500) {
  if (!hasSmtpConfig()) throw new Error("SMTP not configured");
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const transporter = createTransporter();
      const res = await transporter.sendMail(options);
      return res;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw lastError;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!hasTwilioConfig()) return false;
  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body,
      from: process.env.TWILIO_FROM,
      to,
    });
    return true;
  } catch (e) {
    console.error("SMS send failed:", e);
    return false;
  }
}

export async function sendTestEmail(input: TestEmailInput) {
  if (!hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message:
        "SMTP is not configured. Test notification recorded locally only.",
    };
  }

  await createTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.message,
    html: `<p>${input.message.replace(/\n/g, "<br />")}</p>`,
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Test email sent to ${input.to}.`,
  };
}

export async function sendCapaReminder(input: ReminderInput) {
  const subject = `CAPA Due Reminder: ${input.capaId}`;
  const message = `This is a reminder that CAPA ${input.capaId} is due on ${input.dueDate}.\n\nAction: ${input.action}\n\nPlease ensure this corrective action is completed.`;
  
  let emailDelivered = false;
  let smsDelivered = false;
  
  if (!hasSmtpConfig() && !hasTwilioConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: "SMTP and Twilio not configured. Reminder recorded locally.",
    };
  }

  if (hasSmtpConfig()) {
    try {
      await sendMailWithRetry({
        from: process.env.SMTP_FROM,
        to: input.to,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, "<br />")}</p>`,
      });
      emailDelivered = true;
    } catch (e) {
      console.error("Email send failed:", e);
    }
  }

  if (input.phone && hasTwilioConfig()) {
    smsDelivered = await sendSms(input.phone, message);
  }

  return {
    ok: true,
    delivered: emailDelivered || smsDelivered,
    mode: emailDelivered && smsDelivered ? "both" : emailDelivered ? "email" : smsDelivered ? "sms" : "none",
    message: `Reminder ${input.phone ? 'sent' : 'processed'} for ${input.capaId}.`,
  };
}

export function buildIncidentNotification(report: {
  id: string;
  severity: string;
  location: string;
  reporter: string;
  description: string;
  category: string;
  type: string;
  date: string;
}, recipient: string) {
  const subject = `${report.severity} incident alert: ${report.id}`;
  const message = [
    `A ${report.severity.toLowerCase()} incident was reported in the HSE system.`,
    `Report ID: ${report.id}`,
    `Date: ${report.date}`,
    `Location: ${report.location}`,
    `Reporter: ${report.reporter}`,
    `Category: ${report.category}`,
    `Type: ${report.type}`,
    `Description: ${report.description}`,
    "Please review this incident and follow the required response workflow.",
  ].join("\n\n");

  return { recipient, subject, message };
}

export function buildAssignmentNotification(report: {
  id: string;
  severity: string;
  location: string;
  reporter: string;
  description: string;
  category: string;
  type: string;
  date: string;
}, assignee: string) {
  const subject = `Task assigned: ${report.id}`;
  const message = [
    `Report ${report.id} has been assigned to ${assignee}.`,
    `Severity: ${report.severity}`,
    `Location: ${report.location}`,
    `Reporter: ${report.reporter}`,
    `Description: ${report.description}`,
    `Please review the incident and complete the required follow-up steps.`,
  ].join("\n\n");

  return { recipient: assignee, subject, message };
}

export async function sendAssignmentNotification(report: {
  id: string;
  severity: string;
  location: string;
  reporter: string;
  description: string;
  category: string;
  type: string;
  date: string;
}, assignee: string) {
  const notification = buildAssignmentNotification(report, assignee);
  const recipient = notification.recipient.includes("@")
    ? notification.recipient
    : process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_FROM || "safety@crownpaints.co.ke";

  if (!hasSmtpConfig() || !notification.recipient.includes("@")) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Assignment notification queued locally for ${assignee}.`,
      recipient,
    };
  }

  await createTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: notification.subject,
    text: notification.message,
    html: `<p>${notification.message.replace(/\n/g, "<br />")}</p>`,
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Assignment notification sent to ${recipient}.`,
    recipient,
  };
}

export async function sendIncidentNotification(report: {
  id: string;
  severity: string;
  location: string;
  reporter: string;
  description: string;
  category: string;
  type: string;
  date: string;
}, recipient: string) {
  const notification = buildIncidentNotification(report, recipient);

  if (!hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: `Notification queued locally for ${notification.recipient}.`,
    };
  }

  try {
    await sendMailWithRetry({
      from: process.env.SMTP_FROM,
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: `<p>${notification.message.replace(/\n/g, "<br />")}</p>`,
    });
  } catch (err) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: `Notification queued locally for ${notification.recipient}.`,
    };
  }

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Notification sent to ${notification.recipient}.`,
  };
}
