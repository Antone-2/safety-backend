import nodemailer from "nodemailer";
import { z } from "zod";

export const TestEmailSchema = z.object({
  to: z.string().email(),
  subject: z
    .string()
    .min(1)
    .default("Crown Paints EHS email notification test"),
  message: z
    .string()
    .min(1)
    .default("This is a test email from the Crown Paints EHS system."),
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

export async function sendOtpEmail(input: { to: string; code: string; expiresMinutes: number }) {
  const subject = "Your Crown EHS login code";
  const message = [
    `Your one-time login code is ${input.code}.`,
    `This code expires in ${input.expiresMinutes} minutes.`,
    "If you did not request this code, contact your EHS administrator immediately.",
  ].join("\n\n");

  if (!hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: "SMTP is not configured. OTP generated locally only.",
    };
  }

  await createTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject,
    text: message,
    html: `<p>${message.replace(/\n/g, "<br />")}</p>`,
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `OTP sent to ${input.to}.`,
  };
}

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

export async function sendSmsNotification(
  report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
  },
  phone: string,
): Promise<boolean> {
  if (!hasTwilioConfig() || !phone) return false;
  const body = `Crown Paints EHS: Report ${report.id} (${report.severity}) was assigned to you. Location: ${report.location}. Please review and follow up.`;
  return sendSms(phone, body);
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
      await createTransporter().sendMail({
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
    `A ${report.severity.toLowerCase()} incident was reported in the EHS system.`,
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
  mode: "smtp" | "internal" | "failed";
  error?: string;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function reportAssignmentUrl(reportId: string) {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (!frontendUrl) return "";
  return new URL(`/report/${encodeURIComponent(reportId)}`, frontendUrl).toString();
}

export function buildReportAssignmentNotification(
  report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
  },
  recipient: AssignmentRecipient,
  assignedBy?: string,
  primaryRecipient?: string,
) {
  const assignee = primaryRecipient || "the primary assignee";
  const assigner = assignedBy || "the EHS system";
  const reportUrl = reportAssignmentUrl(report.id);
  const subject =
    recipient.role === "assigner"
      ? `Assignment confirmation: ${report.id}`
      : recipient.role === "primary"
        ? `Report assigned to you: ${report.id}`
        : `You were copied on report assignment: ${report.id}`;
  const opening =
    recipient.role === "assigner"
      ? `You assigned report ${report.id} to ${assignee}.`
      : recipient.role === "primary"
        ? `${assigner} assigned report ${report.id} to you.`
        : `${assigner} copied you on report ${report.id}, assigned to ${assignee}.`;
  const action =
    recipient.role === "primary"
      ? "Please review the report and complete the required follow-up actions."
      : "Please review the report for visibility and support the follow-up where required.";
  const message = [
    opening,
    `Severity: ${report.severity}`,
    `Location: ${report.location}`,
    `Reporter: ${report.reporter}`,
    `Category: ${report.category}`,
    `Type: ${report.type}`,
    `Date: ${report.date}`,
    `Description: ${report.description}`,
    reportUrl ? `Open report: ${reportUrl}` : "",
    action,
  ].filter(Boolean).join("\n\n");

  return { recipient: recipient.email, role: recipient.role, subject, message };
}

export async function sendReportAssignmentNotifications(
  report: {
    id: string;
    severity: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    date: string;
  },
  recipients: AssignmentRecipient[],
  assignedBy?: string,
  primaryRecipient?: string,
): Promise<AssignmentDeliveryResult[]> {
  const uniqueRecipients = new Map<string, AssignmentRecipient>();
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    if (!isEmail(email) || uniqueRecipients.has(email)) continue;
    uniqueRecipients.set(email, { ...recipient, email });
  }

  const transporter = hasSmtpConfig() ? createTransporter() : null;
  const results: AssignmentDeliveryResult[] = [];

  for (const recipient of uniqueRecipients.values()) {
    const notification = buildReportAssignmentNotification(report, recipient, assignedBy, primaryRecipient);

    if (!transporter) {
      results.push({
        ...notification,
        delivered: false,
        mode: "internal",
        message: `${notification.message}\n\nSMTP is not configured. Notification recorded locally only.`,
      });
      continue;
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: notification.recipient,
        subject: notification.subject,
        text: notification.message,
        html: `<p>${notification.message.replace(/\n/g, "<br />")}</p>`,
      });
      results.push({ ...notification, delivered: true, mode: "smtp" });
    } catch (error) {
      results.push({
        ...notification,
        delivered: false,
        mode: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
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
    : process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_FROM || "";

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

  await createTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: `<p>${notification.message.replace(/\n/g, "<br />")}</p>`,
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Notification sent to ${notification.recipient}.`,
  };
}
