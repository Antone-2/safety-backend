import { Pool } from "pg";
import type {
  Document,
  DocumentVersion,
  DocumentApproval,
  DocumentAcknowledgement,
  DocumentAccessLink,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateDocumentVersionInput,
  DocumentStats,
} from "./documents.types.js";

const now = () => new Date().toISOString();

function asDocument(row: Record<string, unknown>): Document {
  return {
    id: String(row.id),
    title: String(row.title),
    code: row.code ? String(row.code) : undefined,
    category: String(row.category),
    type: String(row.type) as Document["type"],
    version: String(row.version),
    status: String(row.status) as Document["status"],
    content: row.content ? String(row.content) : undefined,
    fileUrl: row.file_url ? String(row.file_url) : undefined,
    fileName: row.file_name ? String(row.file_name) : undefined,
    fileSize: row.file_size ? Number(row.file_size) : undefined,
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    author: String(row.author),
    reviewer: row.reviewer ? String(row.reviewer) : undefined,
    approver: row.approver ? String(row.approver) : undefined,
    reviewDate: row.review_date ? String(row.review_date) : undefined,
    approvalDate: row.approval_date ? String(row.approval_date) : undefined,
    effectiveDate: String(row.effective_date),
    expiryDate: row.expiry_date ? String(row.expiry_date) : undefined,
    site: String(row.site),
    department: String(row.department),
    tags: Array.isArray(row.tags) ? row.tags.map((t: unknown) => String(t)) : [],
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    createdBy: String(row.created_by),
    documentNo: row.document_no ? String(row.document_no) : undefined,
    owner: row.owner ? String(row.owner) : undefined,
    reviewCycleDays: row.review_cycle_days ? Number(row.review_cycle_days) : undefined,
    nextReviewDate: row.next_review_date ? String(row.next_review_date) : undefined,
    obsoleteReason: row.obsolete_reason ? String(row.obsolete_reason) : undefined,
    classification: String(row.classification),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asVersion(row: Record<string, unknown>): DocumentVersion {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    version: String(row.version),
    changeSummary: String(row.change_summary),
    content: row.content ? String(row.content) : undefined,
    fileUrl: row.file_url ? String(row.file_url) : undefined,
    fileName: row.file_name ? String(row.file_name) : undefined,
    fileSize: row.file_size ? Number(row.file_size) : undefined,
    checksum: String(row.checksum),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

function asApproval(row: Record<string, unknown>): DocumentApproval {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    version: String(row.version),
    step: String(row.step) as DocumentApproval["step"],
    status: String(row.status) as DocumentApproval["status"],
    approverId: row.approver_id ? String(row.approver_id) : undefined,
    approverName: row.approver_name ? String(row.approver_name) : undefined,
    comments: row.comments ? String(row.comments) : undefined,
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    createdAt: String(row.created_at),
  };
}

function asAcknowledgement(row: Record<string, unknown>): DocumentAcknowledgement {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    documentVersion: String(row.document_version),
    userId: String(row.user_id),
    userEmail: String(row.user_email),
    userName: String(row.user_name),
    acknowledgedAt: String(row.acknowledged_at),
    ipAddress: row.ip_address ? String(row.ip_address) : undefined,
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
  };
}

function asAccessLink(row: Record<string, unknown>): DocumentAccessLink {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    tokenHash: String(row.token_hash),
    purpose: String(row.purpose),
    createdBy: String(row.created_by),
    expiresAt: String(row.expires_at),
    downloadCount: Number(row.download_count),
    createdAt: String(row.created_at),
  };
}

export class DocumentsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "title" || key === "code" || key === "site") {
            where.push(`${pgKey} ILIKE $${idx}`);
            params.push(`%${value}%`);
          } else {
            where.push(`${pgKey} = $${idx}`);
            params.push(value);
          }
          idx++;
        }
      });
    }

    const sql = `SELECT * FROM documents ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asDocument(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM documents WHERE id = $1", [id]);
    return result.rows[0] ? asDocument(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreateDocumentInput) {
    const documentNo = `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const result = await this.pool.query(
      `INSERT INTO documents (id, title, code, category, type, version, status, content, file_url, file_name, file_size, mime_type, author, reviewer, approver, effective_date, expiry_date, site, department, tags, parent_id, created_by, document_no, owner, review_cycle_days, classification, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22, $23, $24, $25, $26, $27, $28)
       RETURNING *`,
      [
        data.title,
        data.code ?? null,
        data.category,
        data.type,
        data.version ?? "1.0",
        "Draft",
        data.content ?? null,
        data.fileUrl ?? null,
        data.fileName ?? null,
        data.fileSize ?? null,
        data.mimeType ?? null,
        data.author,
        data.reviewer ?? null,
        data.approver ?? null,
        data.effectiveDate,
        data.expiryDate ?? null,
        data.site,
        data.department,
        JSON.stringify(data.tags ?? []),
        data.parentId ?? null,
        data.createdBy,
        documentNo,
        data.owner ?? null,
        data.reviewCycleDays ?? null,
        data.classification ?? "Internal",
        now(),
        now(),
      ]
    );
    return asDocument(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateDocumentInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      title: "title",
      code: "code",
      category: "category",
      type: "type",
      content: "content",
      fileUrl: "file_url",
      fileName: "file_name",
      fileSize: "file_size",
      mimeType: "mime_type",
      reviewer: "reviewer",
      approver: "approver",
      reviewDate: "review_date",
      approvalDate: "approval_date",
      effectiveDate: "effective_date",
      expiryDate: "expiry_date",
      site: "site",
      department: "department",
      tags: "tags",
      status: "status",
      owner: "owner",
      reviewCycleDays: "review_cycle_days",
      obsoleteReason: "obsolete_reason",
      classification: "classification",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "tags") {
          fields.push(`${map[key]} = $${idx}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${map[key]} = $${idx}`);
          params.push(value);
        }
        idx++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE documents SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asDocument(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM documents WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createVersion(data: CreateDocumentVersionInput, documentId: string, createdBy: string) {
    const result = await this.pool.query(
      `INSERT INTO document_versions (id, document_id, version, change_summary, content, file_url, file_name, file_size, checksum, created_by, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        documentId,
        data.version,
        data.changeSummary,
        data.content ?? null,
        data.fileUrl ?? null,
        data.fileName ?? null,
        data.fileSize ?? null,
        data.checksum || `${documentId}:${data.version}:${data.content || data.fileUrl || ""}`,
        createdBy,
        now(),
      ]
    );
    return asVersion(result.rows[0] as unknown as Record<string, unknown>);
  }

  async findVersions(documentId: string) {
    const result = await this.pool.query("SELECT * FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC", [documentId]);
    return result.rows.map((row) => asVersion(row as unknown as Record<string, unknown>));
  }

  async createApproval(approval: Omit<DocumentApproval, "id" | "createdAt">) {
    const result = await this.pool.query(
      `INSERT INTO document_approvals (id, document_id, version, step, status, approver_id, approver_name, comments, decided_at, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        approval.documentId,
        approval.version,
        approval.step,
        approval.status,
        approval.approverId ?? null,
        approval.approverName ?? null,
        approval.comments ?? null,
        approval.decidedAt ?? null,
        now(),
      ]
    );
    return asApproval(result.rows[0] as unknown as Record<string, unknown>);
  }

  async findApprovals(documentId: string) {
    const result = await this.pool.query("SELECT * FROM document_approvals WHERE document_id = $1 ORDER BY created_at DESC", [documentId]);
    return result.rows.map((row) => asApproval(row as unknown as Record<string, unknown>));
  }

  async createAcknowledgement(ack: Omit<DocumentAcknowledgement, "id" | "acknowledgedAt">) {
    const result = await this.pool.query(
      `INSERT INTO document_acknowledgements (id, document_id, document_version, user_id, user_email, user_name, acknowledged_at, ip_address, user_agent)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        ack.documentId,
        ack.documentVersion,
        ack.userId,
        ack.userEmail,
        ack.userName,
        now(),
        ack.ipAddress ?? null,
        ack.userAgent ?? null,
      ]
    );
    return asAcknowledgement(result.rows[0] as unknown as Record<string, unknown>);
  }

  async findAcknowledgements(documentId: string) {
    const result = await this.pool.query("SELECT * FROM document_acknowledgements WHERE document_id = $1 ORDER BY acknowledged_at DESC", [documentId]);
    return result.rows.map((row) => asAcknowledgement(row as unknown as Record<string, unknown>));
  }

  async createAccessLink(link: Omit<DocumentAccessLink, "id" | "createdAt" | "downloadCount">) {
    const result = await this.pool.query(
      `INSERT INTO document_access_links (id, document_id, token_hash, purpose, created_by, expires_at, download_count, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        link.documentId,
        link.tokenHash,
        link.purpose,
        link.createdBy,
        link.expiresAt,
        0,
        now(),
      ]
    );
    return asAccessLink(result.rows[0] as unknown as Record<string, unknown>);
  }

  async getStats(): Promise<DocumentStats> {
    const result = await this.pool.query("SELECT status, COUNT(*) as count FROM documents GROUP BY status");
    const stats: Record<string, number> = {};
    result.rows.forEach((row) => {
      stats[String(row.status)] = parseInt(row.count as unknown as string, 10);
    });

    const dueResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM documents WHERE next_review_date IS NOT NULL AND next_review_date <= NOW()"
    );
    const dueForReview = parseInt(dueResult.rows[0]?.count ?? "0", 10);

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      approved: stats["Approved"] || 0,
      draft: stats["Draft"] || 0,
      underReview: stats["Under Review"] || 0,
      obsolete: stats["Obsolete"] || 0,
      dueForReview,
    };
  }
}
