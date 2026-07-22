import nodemailer from "nodemailer";
import { z } from "zod";

const BREVO_TRANSACTIONAL_URL = "https://api.brevo.com/v3/smtp/email";

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

export const CapaAssignmentNotificationSchema = z.object({
  to: z.string().email(),
  role: z.enum(["owner", "backup", "escalation"]),
  capaId: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  actionPlan: z.string().min(1),
  dueDate: z.string().min(1),
  site: z.string().min(1),
  department: z.string().min(1),
  owner: z.string().min(1),
  assignedBy: z.string().optional(),
  status: z.string().optional(),
  updateSummary: z.string().optional(),
  url: z.string().optional(),
});

export type CapaAssignmentNotificationInput = z.infer<
  typeof CapaAssignmentNotificationSchema
>;

export const CorrectiveActionRequestEmailSchema = z.object({
  to: z.string().email(),
  recipientName: z.string().optional(),
  reportId: z.string().min(1),
  reportType: z.string().min(1),
  description: z.string().min(1),
  assigneeNote: z.string().optional(),
  dueDate: z.string().optional(),
  url: z.string().min(1),
});

export type CorrectiveActionRequestEmailInput = z.infer<
  typeof CorrectiveActionRequestEmailSchema
>;

export const CorrectiveActionSubmissionNotificationSchema = z.object({
  to: z.string().email(),
  reportId: z.string().min(1),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email(),
  dueDate: z.string().optional(),
  actionPlanDueDate: z.string().optional(),
  actionPlanSummary: z.string().min(1),
  url: z.string().min(1).optional(),
});

export type CorrectiveActionSubmissionNotificationInput = z.infer<
  typeof CorrectiveActionSubmissionNotificationSchema
>;

export const CorrectiveActionReminderEmailSchema = z.object({
  to: z.string().email(),
  reportId: z.string().min(1),
  stage: z.enum(["request", "plan", "task"]),
  dueDate: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  url: z.string().min(1).optional(),
});

export type CorrectiveActionReminderEmailInput = z.infer<
  typeof CorrectiveActionReminderEmailSchema
>;

export const CorrectiveActionSupervisorUpdateEmailSchema = z.object({
  to: z.string().email(),
  reportId: z.string().min(1),
  recipientName: z.string().optional(),
  supervisorName: z.string().optional(),
  updateType: z.enum(["review-update", "comment"]),
  summary: z.string().min(1),
  url: z.string().min(1).optional(),
});

export type CorrectiveActionSupervisorUpdateEmailInput = z.infer<
  typeof CorrectiveActionSupervisorUpdateEmailSchema
>;

export const CorrectiveActionAcknowledgementEmailSchema = z.object({
  to: z.string().email(),
  reportId: z.string().min(1),
  recipientName: z.string().optional(),
  acknowledgedBy: z.string().min(1),
  note: z.string().optional(),
  url: z.string().min(1).optional(),
});

export type CorrectiveActionAcknowledgementEmailInput = z.infer<
  typeof CorrectiveActionAcknowledgementEmailSchema
>;

export interface CapaAssignmentDeliveryResult {
  recipient: string;
  role: "owner" | "backup" | "escalation";
  subject: string;
  message: string;
  delivered: boolean;
  mode: "brevo" | "smtp" | "internal" | "failed";
  error?: string;
}

function getSenderEmail() {
  return (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.NOTIFICATION_FROM_EMAIL ||
    "safety@crownpaints.co.ke"
  );
}

function getCrownLogoUrl() {
  if (process.env.CROWN_LOGO_URL) return process.env.CROWN_LOGO_URL;
  if (process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;

  // Inline Crown Paints mark (white crown + red gem on transparent ground)
  // so the email is branded even without a hosted logo. SVG data URIs render
  // in most modern clients; Outlook shows the alt text as a graceful fallback.
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">' +
    '<path d="M8 30 L13 15 L22 24 L31 15 L36 30 Z" fill="#ffffff"/>' +
    '<rect x="8" y="30" width="28" height="3" rx="1.5" fill="#ffffff"/>' +
    '<circle cx="22" cy="11" r="2.6" fill="#e2231a"/>' +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlFromText(message: string, title = "Crown EHS notification") {
  const content = message
    .split(/\n{2,}/)
    .map((section) => {
      const safeSection = escapeHtml(section.trim()).replace(/\n/g, "<br />");
      return `<div style="margin:0 0 14px;padding:15px 17px;border:1px solid #e3eaf2;border-radius:12px;background:#f8fafc;color:#445268;font-size:14px;line-height:1.65;">${safeSection}</div>`;
    })
    .join("");
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${safeTitle}</title></head>
  <body style="margin:0;padding:0;background:#eef3f8;color:#172033;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(message).slice(0, 140)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef3f8;">
      <tr><td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 48px rgba(8,45,99,.14);">
          <tr><td style="padding:28px 34px;background:#082d63;background-image:linear-gradient(135deg,#082d63 0%,#0b4b91 100%);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
              <td>
                <img src="${getCrownLogoUrl()}" width="44" height="44" alt="Crown Paints" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:44px;" />
                <div style="margin-top:12px;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:.1em;">CROWN PAINTS</div>
                <div style="margin-top:12px;color:#d9eaff;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Environment, Health &amp; Safety</div>
              </td>
              <td align="right" valign="top"><div style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:14px;background:rgba(255,255,255,.14);color:#ffffff;font-size:21px;">&#128276;</div></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:34px 34px 12px;">
            <div style="color:#0b4b91;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;">EHS digital notification</div>
            <h1 style="margin:9px 0 10px;color:#172033;font-size:25px;line-height:1.3;">${safeTitle}</h1>
            <p style="margin:0;color:#697587;font-size:14px;line-height:1.6;">A new update is available in your Crown Paints EHS workspace.</p>
          </td></tr>
          <tr><td style="padding:16px 34px 22px;">${content}</td></tr>
          <tr><td style="padding:18px 34px;border-top:1px solid #e8edf3;background:#fafbfd;color:#7a8494;font-size:12px;line-height:1.65;">
            <div style="color:#172033;font-size:14px;font-weight:700;line-height:1.4;">Let&rsquo;s talk safety,</div>
            <div style="margin-bottom:12px;color:#0b4b91;font-size:13px;font-weight:600;">The Crown Paints EHS Team</div>
            This is an automated operational notification. Please do not reply directly to this email.<br />
            <span style="color:#9aa3b1;">Crown Paints EHS &bull; Safer work through timely action</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function otpEmailHtml(code: string, expiresMinutes: number) {
  const expiryLabel = `${expiresMinutes} minute${expiresMinutes === 1 ? "" : "s"}`;
  const safeCode = code.replace(/[^\d]/g, "").slice(0, 6) || "000000";
  const preheader = `Your Crown Paints EHS login code is ${safeCode}. It expires in ${expiryLabel}. Never share this code with anyone.`;

  // Digital one-time-passcode panel: one bordered box per digit.
  const digitCells = safeCode
    .split("")
    .map(
      (digit) =>
        `<td align="center" valign="middle" style="padding:0 4px;"><div class="otp-box" style="width:52px;height:66px;line-height:66px;background:#082d63;border-radius:12px;color:#ffffff;font-family:'Courier New',Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:1px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18);">${digit}</div></td>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Your Crown Paints EHS login code</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
      * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse !important; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      a { text-decoration: none; }
      .otp-box { font-family: 'Courier New', Consolas, monospace !important; }
      @media only screen and (max-width: 480px) {
        .cp-container { width: 100% !important; }
        .cp-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .cp-title { font-size: 23px !important; line-height: 1.25 !important; }
        .otp-box { width: 40px !important; height: 52px !important; line-height: 52px !important; font-size: 25px !important; }
        .cp-digits td { padding: 0 3px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .cp-body { background: #0f172a !important; }
        .cp-card { background: #111c33 !important; }
        .cp-soft { background: #16233f !important; color: #c7d2e3 !important; }
      }
    </style>
  </head>
  <body class="cp-body" style="margin:0;padding:0;background:#eef3f8;color:#172033;font-family:Inter,Segoe UI,Arial,sans-serif;width:100%;">
    <!-- Hidden inbox preview text -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;visibility:hidden;font-size:1px;line-height:1px;color:#eef3f8;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef3f8;width:100%;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" class="cp-container" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(8,45,99,.16);">
            <!-- Branded header -->
            <tr>
              <td class="cp-pad" style="padding:28px 36px;background:#082d63;background-image:linear-gradient(135deg,#082d63 0%,#0b4b91 60%,#0e5bb0 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <img src="${getCrownLogoUrl()}" width="44" height="44" alt="Crown Paints" style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:44px;" />
                      <div style="margin-top:12px;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:.1em;">CROWN PAINTS</div>
                      <div style="margin-top:12px;color:#cfe2ff;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">Environment, Health &amp; Safety</div>
                    </td>
                    <td align="right" valign="top">
                      <div style="display:inline-block;width:46px;height:46px;line-height:46px;text-align:center;border-radius:14px;background:rgba(255,255,255,.14);color:#ffffff;font-size:22px;">&#128274;</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Intro -->
            <tr>
              <td class="cp-pad" style="padding:34px 36px 14px;">
                <div style="display:inline-block;padding:5px 11px;border-radius:999px;background:#eaf2fc;color:#0b4b91;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Secure authentication</div>
                <h1 class="cp-title" style="margin:12px 0 8px;color:#172033;font-size:26px;line-height:1.25;font-weight:800;">Your login code is ready</h1>
                <p style="margin:0;color:#5d687a;font-size:15px;line-height:1.7;">Enter the one-time passcode below on the Crown EHS sign-in screen to verify it&rsquo;s really you. This is the only step needed to finish signing in.</p>
              </td>
            </tr>
            <!-- Digital OTP panel -->
            <tr>
              <td class="cp-pad" style="padding:14px 36px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d4e3f6;border-radius:18px;background:#f5f9fe;">
                  <tr>
                    <td style="padding:24px 18px 8px;">
                      <div style="text-align:center;color:#6d7a8d;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">One-time passcode</div>
                      <table role="presentation" class="cp-digits" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:14px auto 0;border-collapse:separate;">
                        <tr>${digitCells}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:6px 18px 24px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-table;">
                        <tr>
                          <td style="color:#0b4b91;font-size:15px;padding-right:7px;">&#9201;</td>
                          <td style="color:#445268;font-size:14px;line-height:1.4;">Valid for <strong style="color:#172033;">${expiryLabel}</strong> &bull; Expires in <strong style="color:#172033;">${expiresMinutes}:00</strong></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Secure authentication messaging -->
            <tr>
              <td class="cp-pad" style="padding:4px 36px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:14px;background:#eef7f0;">
                  <tr>
                    <td valign="top" style="padding:16px 0 16px 16px;color:#1f7a47;font-size:18px;">&#128273;</td>
                    <td style="padding:15px 18px 15px 10px;color:#235c41;font-size:13px;line-height:1.65;">
                      <strong style="color:#173f2d;">Securing your sign-in.</strong> This passcode is encrypted in transit and can be used only once. If the request wasn&rsquo;t you, simply close this email &mdash; no action is required.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Anti-phishing warning -->
            <tr>
              <td class="cp-pad" style="padding:6px 36px 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:14px;background:#fff8e8;border:1px solid #f3e2bd;">
                  <tr>
                    <td valign="top" style="padding:16px 0 16px 16px;color:#b66a00;font-size:18px;">&#9888;</td>
                    <td style="padding:15px 18px 15px 10px;color:#6c531d;font-size:13px;line-height:1.65;">
                      <strong style="color:#4d390e;">Anti-phishing warning.</strong> EHS staff will <u>never</u> ask for this code by phone, email, or chat &mdash; not even to &ldquo;verify your account.&rdquo; Always confirm this message was sent from <strong style="color:#4d390e;">safety@crownpaints.co.ke</strong>. Never forward this code.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td class="cp-pad" style="padding:20px 36px;border-top:1px solid #e8edf3;background:#fafbfd;color:#7a8494;font-size:12px;line-height:1.65;">
                <div style="color:#172033;font-size:14px;font-weight:700;line-height:1.4;">Let&rsquo;s talk safety,</div>
                <div style="margin-bottom:12px;color:#0b4b91;font-size:13px;font-weight:600;">The Crown Paints EHS Team</div>
                If you did not request this code, you can safely ignore this email or contact your EHS administrator.<br />
                <span style="color:#9aa3b1;">Automated security notification &bull; Crown Paints EHS &bull; Safer work through timely action</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function hasBrevoConfig() {
  return Boolean(
    process.env.BREVO_API_KEY &&
    getSenderEmail() &&
    process.env.BREVO_API_KEY.trim().length > 0,
  );
}

export async function sendBrevoEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

  const response = await fetch(BREVO_TRANSACTIONAL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Crown Paints Safety",
        email: getSenderEmail(),
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html || htmlFromText(input.text, input.subject),
      textContent: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Brevo email failed with HTTP ${response.status}: ${body}`);
  }
}

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  expiresMinutes: number;
}) {
  const subject = "Your Crown Paints EHS login code";
  const message = [
    `Your one-time login code is ${input.code}.`,
    `This code expires in ${input.expiresMinutes} minutes and can be used only once.`,
    "Security tips:",
    "- Crown Paints will never ask for this code by phone, email, or chat.",
    "- Never share or forward this code with anyone.",
    "- Always confirm this message came from safety@crownpaints.co.ke.",
    "If you did not request this code, you can safely ignore this email.",
    "Crown Paints EHS",
  ].join("\n\n");
  const html = otpEmailHtml(input.code, input.expiresMinutes);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: "SMTP is not configured. OTP generated locally only.",
    };
  }

  if (hasBrevoConfig()) {
    try {
      await sendBrevoEmail({
        to: input.to,
        subject,
        text: message,
        html,
      });
      return {
        ok: true,
        delivered: true,
        mode: "brevo",
        message: `OTP sent to ${input.to}.`,
      };
    } catch (error) {
      console.error("Brevo OTP delivery failed:", error);
      return {
        ok: true,
        delivered: false,
        mode: "brevo-fallback",
        message: "Email delivery failed. OTP generated locally only.",
      };
    }
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: input.to,
    subject,
    text: message,
    html,
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
    const client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
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
  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message:
        "SMTP is not configured. Test notification recorded locally only.",
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: input.to,
      subject: input.subject,
      text: input.message,
      html: htmlFromText(input.message, input.subject),
    });

    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Test email sent to ${input.to}.`,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: input.to,
    subject: input.subject,
    text: input.message,
    html: htmlFromText(input.message, input.subject),
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

  if (!hasBrevoConfig() && !hasSmtpConfig() && !hasTwilioConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: "SMTP and Twilio not configured. Reminder recorded locally.",
    };
  }

  if (hasBrevoConfig()) {
    try {
      await sendBrevoEmail({
        to: input.to,
        subject,
        text: message,
        html: htmlFromText(message, subject),
      });
      emailDelivered = true;
    } catch (e) {
      console.error("Brevo email send failed:", e);
    }
  } else if (hasSmtpConfig()) {
    try {
      await createTransporter().sendMail({
        from: getSenderEmail(),
        to: input.to,
        subject,
        text: message,
        html: htmlFromText(message, subject),
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
    mode:
      emailDelivered && smsDelivered
        ? "both"
        : emailDelivered
          ? "email"
          : smsDelivered
            ? "sms"
            : "none",
    message: `Reminder ${input.phone ? "sent" : "processed"} for ${input.capaId}.`,
  };
}

export function buildIncidentNotification(
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
  recipient: string,
) {
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

export function buildAssignmentNotification(
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
  assignee: string,
) {
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
  mode: "brevo" | "smtp" | "internal" | "failed";
  error?: string;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function reportAssignmentUrl(reportId: string) {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (!frontendUrl) return "";
  return new URL(
    `/report/${encodeURIComponent(reportId)}`,
    frontendUrl,
  ).toString();
}

function capaAssignmentUrl(capaId: string) {
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (!frontendUrl) return "";
  return new URL(`/capa?focus=${encodeURIComponent(capaId)}`, frontendUrl).toString();
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
  ]
    .filter(Boolean)
    .join("\n\n");

  return { recipient: recipient.email, role: recipient.role, subject, message };
}

export function buildCorrectiveActionRequestNotification(
  input: CorrectiveActionRequestEmailInput,
) {
  const subject = `Corrective action form assigned: ${input.reportId}`;
  const opening = input.recipientName
    ? `Hello ${input.recipientName}, a corrective action form has been assigned to you for report ${input.reportId}.`
    : `A corrective action form has been assigned to you for report ${input.reportId}.`;
  const message = [
    opening,
    `Report type: ${input.reportType}`,
    `Description: ${input.description}`,
    input.assigneeNote ? `Assignment note: ${input.assigneeNote}` : "",
    input.dueDate ? `Requested due date: ${input.dueDate}` : "",
    `Open corrective action form: ${input.url}`,
    "Complete the form with the unsafe act/condition/incident/accident classification, immediate correction taken, root cause analysis, and detailed action plan.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: input.to,
    subject,
    message,
  };
}

export function buildCorrectiveActionSubmissionNotification(
  input: CorrectiveActionSubmissionNotificationInput,
) {
  const parsed = CorrectiveActionSubmissionNotificationSchema.parse(input);
  const subject = `Corrective action plan submitted: ${parsed.reportId}`;
  const message = [
    `${parsed.recipientName || parsed.recipientEmail} has submitted the corrective action plan for report ${parsed.reportId}.`,
    parsed.dueDate ? `Original assigned due date: ${parsed.dueDate}` : "",
    parsed.actionPlanDueDate
      ? `Assignee action-plan due date: ${parsed.actionPlanDueDate}`
      : "",
    `Action plan summary: ${parsed.actionPlanSummary}`,
    parsed.url ? `Open corrective action form: ${parsed.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: parsed.to,
    subject,
    message,
  };
}

export function buildCorrectiveActionReminderNotification(
  input: CorrectiveActionReminderEmailInput,
) {
  const parsed = CorrectiveActionReminderEmailSchema.parse(input);
  const stageLabel =
    parsed.stage === "request"
      ? "corrective action response"
      : parsed.stage === "plan"
        ? "corrective action plan completion"
        : "corrective action task";
  const subject = `Reminder: ${parsed.reportId} ${stageLabel} due`;
  const message = [
    `This is a reminder that the ${stageLabel} for report ${parsed.reportId} is due on ${parsed.dueDate}.`,
    `Item: ${parsed.title}`,
    parsed.description ? `Details: ${parsed.description}` : "",
    parsed.url ? `Open corrective action form: ${parsed.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: parsed.to,
    subject,
    message,
  };
}

export function buildCorrectiveActionSupervisorUpdateNotification(
  input: CorrectiveActionSupervisorUpdateEmailInput,
) {
  const parsed = CorrectiveActionSupervisorUpdateEmailSchema.parse(input);
  const subject =
    parsed.updateType === "comment"
      ? `Supervisor comment added: ${parsed.reportId}`
      : `Corrective action review updated: ${parsed.reportId}`;
  const opening =
    parsed.recipientName && parsed.supervisorName
      ? `Hello ${parsed.recipientName}, ${parsed.supervisorName} updated your corrective action request for report ${parsed.reportId}.`
      : parsed.recipientName
        ? `Hello ${parsed.recipientName}, your corrective action request for report ${parsed.reportId} was updated by a supervisor.`
        : `Your corrective action request for report ${parsed.reportId} was updated by a supervisor.`;
  const actionLine =
    parsed.updateType === "comment"
      ? "A supervisor added follow-up comments that need your attention."
      : "A supervisor reviewed the action plan and updated the task status or due date.";
  const message = [
    opening,
    actionLine,
    `Update summary: ${parsed.summary}`,
    parsed.url ? `Open corrective action form: ${parsed.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: parsed.to,
    subject,
    message,
  };
}

export function buildCorrectiveActionAcknowledgementNotification(
  input: CorrectiveActionAcknowledgementEmailInput,
) {
  const parsed = CorrectiveActionAcknowledgementEmailSchema.parse(input);
  const subject = `Corrective action follow-up acknowledged: ${parsed.reportId}`;
  const message = [
    `${parsed.acknowledgedBy} acknowledged the supervisor follow-up for report ${parsed.reportId}.`,
    parsed.note ? `Acknowledgement note: ${parsed.note}` : "",
    parsed.url ? `Open corrective action form: ${parsed.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: parsed.to,
    subject,
    message,
  };
}

export function buildCapaAssignmentNotification(
  input: CapaAssignmentNotificationInput,
) {
  const parsed = CapaAssignmentNotificationSchema.parse(input);
  const assignedBy = parsed.assignedBy || "the Crown Paints EHS team";
  const roleLabel =
    parsed.role === "owner"
      ? "Primary owner"
      : parsed.role === "backup"
        ? "Backup assignee"
        : "Escalation contact";
  const subject = parsed.updateSummary
    ? `CAPA assignment updated: ${parsed.capaId}`
    : `CAPA assigned: ${parsed.capaId}`;
  const opening = parsed.updateSummary
    ? `${assignedBy} updated your CAPA assignment for ${parsed.capaId}.`
    : `${assignedBy} assigned CAPA ${parsed.capaId} to you.`;
  const action = parsed.role === "escalation"
    ? "Monitor progress and support escalation if the CAPA becomes overdue."
    : "Review the CAPA tasks and complete the required follow-up actions by the due date.";
  const message = [
    opening,
    `Role: ${roleLabel}`,
    `Title: ${parsed.title}`,
    `Source: ${parsed.source}`,
    `Site: ${parsed.site}`,
    `Department: ${parsed.department}`,
    `Primary owner: ${parsed.owner}`,
    `Due date: ${parsed.dueDate}`,
    parsed.status ? `Current status: ${parsed.status}` : "",
    `Action plan: ${parsed.actionPlan}`,
    parsed.updateSummary ? `Updated assignment details: ${parsed.updateSummary}` : "",
    parsed.url ? `Open CAPA: ${parsed.url}` : "",
    action,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    recipient: parsed.to,
    role: parsed.role,
    subject,
    message,
  };
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

  const transporter =
    !hasBrevoConfig() && hasSmtpConfig() ? createTransporter() : null;
  const results: AssignmentDeliveryResult[] = [];

  for (const recipient of uniqueRecipients.values()) {
    const notification = buildReportAssignmentNotification(
      report,
      recipient,
      assignedBy,
      primaryRecipient,
    );

    if (!hasBrevoConfig() && !transporter) {
      results.push({
        ...notification,
        delivered: false,
        mode: "internal",
        message: `${notification.message}\n\nSMTP is not configured. Notification recorded locally only.`,
      });
      continue;
    }

    try {
      if (hasBrevoConfig()) {
        await sendBrevoEmail({
          to: notification.recipient,
          subject: notification.subject,
          text: notification.message,
          html: htmlFromText(notification.message, notification.subject),
        });
        results.push({ ...notification, delivered: true, mode: "brevo" });
      } else if (transporter) {
        await transporter.sendMail({
          from: getSenderEmail(),
          to: notification.recipient,
          subject: notification.subject,
          text: notification.message,
          html: htmlFromText(notification.message, notification.subject),
        });
        results.push({ ...notification, delivered: true, mode: "smtp" });
      }
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

export async function sendCorrectiveActionRequestEmail(
  input: CorrectiveActionRequestEmailInput,
) {
  const parsed = CorrectiveActionRequestEmailSchema.parse(input);
  const notification = buildCorrectiveActionRequestNotification(parsed);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Corrective action request queued locally for ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Corrective action request sent to ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Corrective action request sent to ${notification.recipient}.`,
    recipient: notification.recipient,
  };
}

export async function sendCorrectiveActionSubmissionNotification(
  input: CorrectiveActionSubmissionNotificationInput,
) {
  const parsed = CorrectiveActionSubmissionNotificationSchema.parse(input);
  const notification = buildCorrectiveActionSubmissionNotification(parsed);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Corrective action submission queued locally for ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Corrective action submission sent to ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Corrective action submission sent to ${notification.recipient}.`,
    recipient: notification.recipient,
  };
}

export async function sendCorrectiveActionReminderEmail(
  input: CorrectiveActionReminderEmailInput,
) {
  const parsed = CorrectiveActionReminderEmailSchema.parse(input);
  const notification = buildCorrectiveActionReminderNotification(parsed);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Corrective action reminder queued locally for ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Corrective action reminder sent to ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Corrective action reminder sent to ${notification.recipient}.`,
    recipient: notification.recipient,
  };
}

export async function sendCorrectiveActionSupervisorUpdateEmail(
  input: CorrectiveActionSupervisorUpdateEmailInput,
) {
  const parsed = CorrectiveActionSupervisorUpdateEmailSchema.parse(input);
  const notification = buildCorrectiveActionSupervisorUpdateNotification(parsed);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Corrective action supervisor update queued locally for ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Corrective action supervisor update sent to ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Corrective action supervisor update sent to ${notification.recipient}.`,
    recipient: notification.recipient,
  };
}

export async function sendCorrectiveActionAcknowledgementEmail(
  input: CorrectiveActionAcknowledgementEmailInput,
) {
  const parsed = CorrectiveActionAcknowledgementEmailSchema.parse(input);
  const notification = buildCorrectiveActionAcknowledgementNotification(parsed);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Corrective action acknowledgement queued locally for ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Corrective action acknowledgement sent to ${notification.recipient}.`,
      recipient: notification.recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Corrective action acknowledgement sent to ${notification.recipient}.`,
    recipient: notification.recipient,
  };
}

export async function sendCapaAssignmentNotifications(
  inputs: CapaAssignmentNotificationInput[],
): Promise<CapaAssignmentDeliveryResult[]> {
  const uniqueRecipients = new Map<string, CapaAssignmentNotificationInput>();
  for (const input of inputs) {
    const email = input.to.trim().toLowerCase();
    if (!isEmail(email) || uniqueRecipients.has(`${email}:${input.role}`)) continue;
    uniqueRecipients.set(`${email}:${input.role}`, { ...input, to: email });
  }

  const transporter =
    !hasBrevoConfig() && hasSmtpConfig() ? createTransporter() : null;
  const results: CapaAssignmentDeliveryResult[] = [];

  for (const input of uniqueRecipients.values()) {
    const notification = buildCapaAssignmentNotification({
      ...input,
      url: input.url || capaAssignmentUrl(input.capaId),
    });

    if (!hasBrevoConfig() && !transporter) {
      results.push({
        ...notification,
        delivered: false,
        mode: "internal",
        message: `${notification.message}\n\nSMTP is not configured. Notification recorded locally only.`,
      });
      continue;
    }

    try {
      if (hasBrevoConfig()) {
        await sendBrevoEmail({
          to: notification.recipient,
          subject: notification.subject,
          text: notification.message,
          html: htmlFromText(notification.message, notification.subject),
        });
        results.push({ ...notification, delivered: true, mode: "brevo" });
      } else if (transporter) {
        await transporter.sendMail({
          from: getSenderEmail(),
          to: notification.recipient,
          subject: notification.subject,
          text: notification.message,
          html: htmlFromText(notification.message, notification.subject),
        });
        results.push({ ...notification, delivered: true, mode: "smtp" });
      }
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

export async function sendAssignmentNotification(
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
  assignee: string,
) {
  const notification = buildAssignmentNotification(report, assignee);
  const recipient = notification.recipient.includes("@")
    ? notification.recipient
    : process.env.DEFAULT_NOTIFICATION_EMAIL || getSenderEmail() || "";

  if (
    (!hasBrevoConfig() && !hasSmtpConfig()) ||
    !notification.recipient.includes("@")
  ) {
    return {
      ok: true,
      delivered: false,
      mode: "internal",
      message: `Assignment notification queued locally for ${assignee}.`,
      recipient,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Assignment notification sent to ${recipient}.`,
      recipient,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Assignment notification sent to ${recipient}.`,
    recipient,
  };
}

export async function sendIncidentNotification(
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
  recipient: string,
) {
  const notification = buildIncidentNotification(report, recipient);

  if (!hasBrevoConfig() && !hasSmtpConfig()) {
    return {
      ok: true,
      delivered: false,
      mode: "local-test",
      message: `Notification queued locally for ${notification.recipient}.`,
    };
  }

  if (hasBrevoConfig()) {
    await sendBrevoEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: htmlFromText(notification.message, notification.subject),
    });
    return {
      ok: true,
      delivered: true,
      mode: "brevo",
      message: `Notification sent to ${notification.recipient}.`,
    };
  }

  await createTransporter().sendMail({
    from: getSenderEmail(),
    to: notification.recipient,
    subject: notification.subject,
    text: notification.message,
    html: htmlFromText(notification.message, notification.subject),
  });

  return {
    ok: true,
    delivered: true,
    mode: "smtp",
    message: `Notification sent to ${notification.recipient}.`,
  };
}
