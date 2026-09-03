import { z } from "zod";

export const AssignmentStatusSchema = z.enum([
  "Draft", "Assigned", "Viewed", "Accepted", "In Progress", "Paused", "Submitted",
  "Under Review", "Rework", "Approved", "Verified", "Closed", "Rejected", "Cancelled",
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const AssignmentPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const AssignmentParticipantRoleSchema = z.enum([
  "assignee", "backup", "delegate", "copied", "watcher", "reviewer", "verifier",
]);

export const CreateAssignmentSchema = z.object({
  reportId: z.string().min(1).max(100),
  assigneeEmail: z.string().trim().toLowerCase().email(),
  assigneeName: z.string().trim().max(200).optional(),
  copiedEmails: z.array(z.string().trim().toLowerCase().email()).max(100).default([]),
  backupEmail: z.string().trim().toLowerCase().email().optional(),
  reviewerEmail: z.string().trim().toLowerCase().email().optional(),
  verifierEmail: z.string().trim().toLowerCase().email().optional(),
  priority: AssignmentPrioritySchema.default("Medium"),
  reason: z.string().trim().min(1).max(2000),
  responseDueAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  verificationDueAt: z.string().datetime().optional(),
  templateId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const AssignmentTransitionSchema = z.object({
  event: z.enum([
    "view", "accept", "reject", "start", "pause", "resume", "submit", "review",
    "request-rework", "approve", "verify", "close", "reopen", "cancel",
  ]),
  reason: z.string().trim().max(5000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const ReassignAssignmentSchema = z.object({
  assigneeEmail: z.string().trim().toLowerCase().email(),
  assigneeName: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(1).max(2000),
  keepPreviousAsCopied: z.boolean().default(true),
  expectedVersion: z.number().int().positive().optional(),
});

export const DelegateAssignmentSchema = z.object({
  delegateEmail: z.string().trim().toLowerCase().email(),
  delegateName: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(1).max(2000),
  dueAt: z.string().datetime().optional(),
});

export const AssignmentTaskSchema = z.object({
  parentTaskId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).optional(),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerName: z.string().trim().max(200).optional(),
  milestone: z.boolean().default(false),
  estimatedMinutes: z.number().int().positive().max(525600).optional(),
  dueAt: z.string().datetime().optional(),
  dependsOnTaskIds: z.array(z.string().uuid()).max(50).default([]),
});

export const AssignmentTaskUpdateSchema = z.object({
  status: z.enum(["Planned", "Assigned", "In Progress", "Blocked", "Completed", "Verified", "Cancelled"]).optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  reason: z.string().trim().max(2000).optional(),
}).refine((value) => value.status !== "Blocked" || Boolean(value.reason), { message: "A reason is required when blocking a task" });

export const AssignmentTaskDependenciesSchema = z.object({
  dependsOnTaskIds: z.array(z.string().uuid()).max(50),
  reason: z.string().trim().min(1).max(2000),
});

export const AssignmentCommentSchema = z.object({
  parentCommentId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(10000),
  visibility: z.enum(["shared", "internal"]).default("shared"),
  mentions: z.array(z.string().trim().toLowerCase().email()).max(50).default([]),
});

export const AssignmentEvidenceSchema = z.object({
  taskId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(500),
  fileUrl: z.string().trim().url().max(4000),
  mimeType: z.string().trim().max(200).optional(),
  fileSize: z.number().int().nonnegative().max(100 * 1024 * 1024).optional(),
  checksum: z.string().trim().min(16).max(256),
  description: z.string().trim().max(2000).optional(),
  evidenceType: z.enum(["Before Photo", "After Photo", "Document", "Certificate", "Inspection", "Work Order", "Video", "Other"]).default("Other"),
});

export const AssignmentEvidenceReviewSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  notes: z.string().trim().max(5000).optional(),
}).refine((value) => value.status !== "Rejected" || Boolean(value.notes), { message: "Review notes are required when rejecting evidence" });

export const AssignmentWatcherSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(200).optional(),
});

export const BulkAssignmentSchema = z.object({
  reportIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  assigneeEmail: z.string().trim().toLowerCase().email(),
  copiedEmails: z.array(z.string().trim().toLowerCase().email()).max(100).default([]),
  priority: AssignmentPrioritySchema.default("Medium"),
  reason: z.string().trim().min(1).max(2000),
  dueAt: z.string().datetime().optional(),
  templateId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const AssignmentTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional(),
  supersedesTemplateId: z.string().uuid().optional(),
  reportType: z.string().trim().max(100).optional(), severity: z.string().trim().max(50).optional(),
  site: z.string().trim().max(200).optional(), department: z.string().trim().max(200).optional(),
  defaultPriority: AssignmentPrioritySchema.default("Medium"),
  responseSlaHours: z.number().int().positive().max(8760).optional(), completionSlaHours: z.number().int().positive().max(8760).optional(),
  verificationSlaHours: z.number().int().positive().max(8760).optional(), defaultAssigneeRole: z.string().max(100).optional(),
  defaultReviewerEmail: z.string().email().optional(), defaultVerifierEmail: z.string().email().optional(),
  taskBlueprint: z.array(AssignmentTaskSchema.omit({ parentTaskId: true, dependsOnTaskIds: true })).max(100).default([]),
  evidenceRequirements: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
});

export const AssignmentNotificationPreferenceSchema = z.object({
  channels: z.array(z.enum(["email", "sms", "whatsapp", "in-app", "teams"])).min(1).max(5),
  assignmentEvents: z.array(z.enum(["assigned", "due-soon", "overdue", "review", "rework", "escalated"])).min(1),
  digestCadence: z.enum(["immediate", "daily", "weekly"]),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  timezone: z.string().min(1).max(100).default("Africa/Nairobi"),
  criticalBypassQuietHours: z.boolean().default(true),
  phone: z.string().trim().max(50).nullable().optional(),
  teamsRecipient: z.string().trim().max(500).nullable().optional(),
});

export const EscalationPolicySchema = z.object({
  name: z.string().trim().min(1).max(200), severity: z.string().trim().max(50).optional(), site: z.string().trim().max(200).optional(),
  responseSlaHours: z.number().int().positive().max(8760), completionSlaHours: z.number().int().positive().max(8760),
  levels: z.array(z.object({ afterHours: z.number().int().positive().max(8760), recipients: z.array(z.enum(["assignee", "assigner", "copied", "reviewer", "verifier"])).min(1), channels: z.array(z.enum(["email", "sms", "whatsapp", "in-app", "teams"])).min(1) })).min(1).max(10),
  businessCalendar: z.object({ workingDays: z.array(z.number().int().min(0).max(6)).min(1), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24), holidays: z.array(z.string().date()).default([]), timezone: z.string().trim().min(1).max(100).default("Africa/Nairobi") }),
});

export const AssignmentCommentEditSchema = z.object({ body: z.string().trim().min(1).max(10000), reason: z.string().trim().min(1).max(2000) });

export const EffectivenessReviewSchema = z.object({
  outcome: z.enum(["Effective", "Partially Effective", "Ineffective"]),
  effectivenessScore: z.number().int().min(0).max(100),
  residualRisk: z.enum(["Low", "Medium", "High", "Critical"]),
  recurrenceDetected: z.boolean().default(false),
  followUpInspectionRequired: z.boolean().default(false),
  followUpDueAt: z.string().datetime().optional(),
  notes: z.string().trim().min(1).max(10000),
}).refine((value) => !value.followUpInspectionRequired || Boolean(value.followUpDueAt), { message: "A follow-up date is required when inspection follow-up is selected" });

export const AssignmentSignatureSchema = z.object({
  signatureType: z.enum(["submission", "approval", "verification", "closure", "reopening"]),
  declaration: z.string().trim().min(10).max(2000),
  expectedVersion: z.number().int().positive(),
});

export const AssignmentLegalHoldSchema = z.object({ reason: z.string().trim().min(1).max(5000) });

export const AssignmentDeadlineSchema = z.object({
  responseDueAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  verificationDueAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(1).max(2000),
  expectedVersion: z.number().int().positive(),
}).refine((value) => value.responseDueAt !== undefined || value.dueAt !== undefined || value.verificationDueAt !== undefined, { message: "At least one deadline must be supplied" });

export const AssignmentRetentionPolicySchema = z.object({
  name: z.string().trim().min(1).max(200), site: z.string().trim().max(200).optional(),
  severity: z.string().trim().max(50).optional(), retentionYears: z.number().int().min(1).max(100),
});

export const AssignmentRoutingRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  reportType: z.string().trim().max(100).optional(), severity: z.string().trim().max(50).optional(),
  site: z.string().trim().max(200).optional(), department: z.string().trim().max(200).optional(),
  assigneeEmail: z.string().trim().toLowerCase().email(),
  copiedEmails: z.array(z.string().trim().toLowerCase().email()).max(100).default([]),
  templateId: z.string().uuid().optional(), priority: AssignmentPrioritySchema.optional(),
  ruleOrder: z.number().int().min(1).max(10000).default(100), active: z.boolean().default(true),
});

export interface AssignmentRecord {
  id: string;
  reportId: string;
  status: AssignmentStatus;
  priority: z.infer<typeof AssignmentPrioritySchema>;
  assigneeId?: string;
  assigneeEmail: string;
  assigneeName?: string;
  assignedById?: string;
  assignedByEmail: string;
  assignedByName?: string;
  site?: string;
  department?: string;
  assignmentReason?: string;
  responseDueAt?: string;
  dueAt?: string;
  verificationDueAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const ASSIGNMENT_TRANSITIONS: Record<string, Partial<Record<AssignmentTransitionInput, AssignmentStatus>>> = {
  Draft: { accept: "Accepted", cancel: "Cancelled" },
  Assigned: { view: "Viewed", accept: "Accepted", reject: "Rejected", cancel: "Cancelled" },
  Viewed: { accept: "Accepted", reject: "Rejected", cancel: "Cancelled" },
  Accepted: { start: "In Progress", reject: "Rejected", cancel: "Cancelled" },
  "In Progress": { pause: "Paused", submit: "Submitted", cancel: "Cancelled" },
  Paused: { resume: "In Progress", cancel: "Cancelled" },
  Rework: { start: "In Progress", submit: "Submitted", cancel: "Cancelled" },
  Submitted: { review: "Under Review" },
  "Under Review": { "request-rework": "Rework", approve: "Approved" },
  Approved: { verify: "Verified", "request-rework": "Rework" },
  Verified: { close: "Closed", reopen: "Rework" },
  Closed: { reopen: "Rework" },
  Rejected: { reopen: "Assigned", cancel: "Cancelled" },
};

export type AssignmentTransitionInput = z.infer<typeof AssignmentTransitionSchema>["event"];
