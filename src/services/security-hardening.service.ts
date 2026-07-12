import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";

const now = () => new Date().toISOString();

function parseJson(value: unknown, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function actorName(actor?: { name?: string; email?: string }) {
  return actor?.email || actor?.name || "System";
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export class SecurityHardeningService {
  async upsertPolicy(
    policyKey: string,
    policyValue: Record<string, unknown>,
    description: string,
    actor?: { name?: string; email?: string },
  ) {
    const db = await getDb();
    const updatedAt = now();
    const row = {
      id: uuidv4(),
      policyKey,
      policyValue: JSON.stringify(policyValue),
      description,
      updatedBy: actorName(actor),
      updatedAt,
    };
    db.prepare(
      `INSERT OR REPLACE INTO security_policies
       (id, policyKey, policyValue, description, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(row));
    await saveDb(db);
    return { ...row, policyValue };
  }

  async listPolicies() {
    const db = await getDb();
    return allRows(
      db,
      "SELECT * FROM security_policies ORDER BY policyKey ASC",
    ).map((row) => ({ ...row, policyValue: parseJson(row.policyValue, {}) }));
  }

  async recordFileScan(input: {
    fileKey: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedBy?: string;
    content?: Buffer | string;
  }) {
    const findings: string[] = [];
    const allowedTypes = (
      process.env.ALLOWED_UPLOAD_MIME_TYPES ||
      "image/png,image/jpeg,image/webp,application/pdf,text/plain"
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

    if (input.mimeType && !allowedTypes.includes(input.mimeType)) {
      findings.push(`MIME type ${input.mimeType} is not allowed.`);
    }
    if (input.sizeBytes && input.sizeBytes > maxBytes) {
      findings.push(`File size ${input.sizeBytes} exceeds ${maxBytes} bytes.`);
    }
    if (
      /\.(exe|bat|cmd|ps1|js|vbs|scr|dll)$/i.test(
        input.fileName || input.fileKey,
      )
    ) {
      findings.push("Executable/script upload extension is blocked.");
    }

    const status = findings.length ? "blocked" : "passed";
    const db = await getDb();
    const row = {
      id: uuidv4(),
      fileKey: input.fileKey,
      fileName: input.fileName || null,
      mimeType: input.mimeType || null,
      sizeBytes: input.sizeBytes || null,
      checksum: input.content ? sha256(input.content) : sha256(input.fileKey),
      status,
      scanner: "policy",
      findings: JSON.stringify(findings),
      scannedAt: now(),
      uploadedBy: input.uploadedBy || null,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO file_security_scans
       (id, fileKey, fileName, mimeType, sizeBytes, checksum, status, scanner, findings, scannedAt, uploadedBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(row));
    await saveDb(db);
    return { ...row, findings };
  }

  async listFileScans(status?: string) {
    const db = await getDb();
    const rows = status
      ? allRows(
          db,
          "SELECT * FROM file_security_scans WHERE status = ? ORDER BY createdAt DESC LIMIT 250",
          [status],
        )
      : allRows(
          db,
          "SELECT * FROM file_security_scans ORDER BY createdAt DESC LIMIT 250",
        );
    return rows.map((row) => ({
      ...row,
      findings: parseJson(row.findings, []),
    }));
  }

  async upsertRetentionPolicy(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const db = await getDb();
    const updatedAt = now();
    const row = {
      id: data.id || uuidv4(),
      resourceType: data.resourceType,
      retentionDays: Number(data.retentionDays),
      legalHold: data.legalHold ? 1 : 0,
      disposalAction: data.disposalAction || "anonymize",
      updatedBy: actorName(actor),
      updatedAt,
    };
    db.prepare(
      `INSERT OR REPLACE INTO data_retention_policies
       (id, resourceType, retentionDays, legalHold, disposalAction, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(row));
    await saveDb(db);
    return { ...row, legalHold: Boolean(row.legalHold) };
  }

  async listRetentionPolicies() {
    const db = await getDb();
    return allRows(
      db,
      "SELECT * FROM data_retention_policies ORDER BY resourceType ASC",
    ).map((row) => ({ ...row, legalHold: Boolean(row.legalHold) }));
  }

  async recordSecretRotation(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const lastRotatedAt = data.lastRotatedAt || now();
    const frequency = Number(data.rotationFrequencyDays || 90);
    const nextRotationDueAt =
      data.nextRotationDueAt ||
      new Date(Date.parse(lastRotatedAt) + frequency * 86400000).toISOString();
    const db = await getDb();
    const row = {
      id: data.id || uuidv4(),
      secretName: data.secretName,
      owner: data.owner || actorName(actor),
      rotationFrequencyDays: frequency,
      lastRotatedAt,
      nextRotationDueAt,
      status: data.status || "scheduled",
      evidence: data.evidence || null,
      updatedBy: actorName(actor),
      updatedAt: now(),
    };
    db.prepare(
      `INSERT OR REPLACE INTO secrets_rotation_log
       (id, secretName, owner, rotationFrequencyDays, lastRotatedAt, nextRotationDueAt, status, evidence, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(Object.values(row));
    await saveDb(db);
    return row;
  }

  async listSecretRotations() {
    const db = await getDb();
    return allRows(
      db,
      "SELECT * FROM secrets_rotation_log ORDER BY nextRotationDueAt ASC",
    );
  }

  async dashboard() {
    const [policies, retention, rotations, scans] = await Promise.all([
      this.listPolicies(),
      this.listRetentionPolicies(),
      this.listSecretRotations(),
      this.listFileScans(),
    ]);
    return {
      policies,
      retention,
      secretRotationsDue: rotations.filter(
        (item) =>
          item.status !== "completed" &&
          item.nextRotationDueAt &&
          new Date(item.nextRotationDueAt) <= new Date(),
      ),
      blockedFiles: scans.filter((item) => item.status === "blocked"),
      owaspChecklist: [
        {
          item: "Broken access control",
          status: "covered",
          evidence: "RBAC middleware and admin route guards",
        },
        {
          item: "Cryptographic failures",
          status: "partial",
          evidence:
            "JWT/OTP hashing, optional backup encryption, secrets rotation log",
        },
        {
          item: "Injection",
          status: "covered",
          evidence: "Parameterized SQL in core modules",
        },
        {
          item: "Insecure design",
          status: "partial",
          evidence: "Security policy records and audit trails",
        },
        {
          item: "Security misconfiguration",
          status: "covered",
          evidence: "Security headers and production CORS lockdown",
        },
        {
          item: "Vulnerable components",
          status: "covered",
          evidence: "CI dependency audit and Trivy scan",
        },
        {
          item: "Auth failures",
          status: "covered",
          evidence: "OTP throttling, session revocation, active-session APIs",
        },
        {
          item: "Software/data integrity",
          status: "partial",
          evidence: "Migration dry-run, Docker build, deployment gates",
        },
        {
          item: "Logging/monitoring",
          status: "covered",
          evidence: "Operational events, audit logs, Sentry integration",
        },
        {
          item: "SSRF",
          status: "partial",
          evidence: "Photo proxy URL handling still needs allowlist expansion",
        },
      ],
    };
  }
}

export const securityHardeningService = new SecurityHardeningService();
