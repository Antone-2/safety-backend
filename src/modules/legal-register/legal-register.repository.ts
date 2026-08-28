import { Pool } from "pg";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import type {
  LegalRegisterEntry,
  LegalObligation,
  ObligationReview,
  ObligationEvidence,
  ObligationAction,
  CreateLegalRegisterEntryInput,
  UpdateLegalRegisterEntryInput,
  CreateLegalObligationInput,
  UpdateLegalObligationInput,
  CreateObligationReviewInput,
  UpdateObligationReviewInput,
  CreateObligationEvidenceInput,
  CreateObligationActionInput,
  UpdateObligationActionInput,
  LegalRegisterDashboard,
} from "./legal-register.types.js";

const now = () => new Date().toISOString();

function asRegisterEntry(row: Record<string, unknown>): LegalRegisterEntry {
  return {
    id: String(row.id),
    title: String(row.title),
    legislation: String(row.legislation),
    jurisdiction: String(row.jurisdiction),
    authority: String(row.authority),
    effectiveDate: String(row.effective_date),
    reviewDate: row.review_date ? String(row.review_date) : undefined,
    summary: String(row.summary),
    scope: Array.isArray(row.scope) ? row.scope.map((s: unknown) => String(s)) : [],
    status: String(row.status) as LegalRegisterEntry["status"],
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asObligation(row: Record<string, unknown>): LegalObligation {
  return {
    id: String(row.id),
    registerEntryId: String(row.register_entry_id),
    title: String(row.title),
    requirement: String(row.requirement),
    frequency: String(row.frequency),
    responsibility: String(row.responsibility),
    site: String(row.site),
    department: String(row.department),
    dueDate: row.due_date ? String(row.due_date) : undefined,
    lifecycle: String(row.lifecycle) as LegalObligation["lifecycle"],
    lastReviewDate: row.last_review_date ? String(row.last_review_date) : undefined,
    nextReviewDate: row.next_review_date ? String(row.next_review_date) : undefined,
    evidenceCount: Number(row.evidence_count ?? 0),
    openActionsCount: Number(row.open_actions_count ?? 0),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asReview(row: Record<string, unknown>): ObligationReview {
  return {
    id: String(row.id),
    obligationId: String(row.obligation_id),
    title: String(row.title),
    status: String(row.status) as ObligationReview["status"],
    reviewDate: String(row.review_date),
    reviewer: String(row.reviewer),
    findings: String(row.findings),
    conclusion: String(row.conclusion),
    followUpRequired: Boolean(row.follow_up_required),
    followUpDate: row.follow_up_date ? String(row.follow_up_date) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asEvidence(row: Record<string, unknown>): ObligationEvidence {
  return {
    id: String(row.id),
    obligationId: String(row.obligation_id),
    reviewId: row.review_id ? String(row.review_id) : undefined,
    type: String(row.type) as ObligationEvidence["type"],
    name: String(row.name),
    url: String(row.url),
    description: row.description ? String(row.description) : undefined,
    uploadedBy: String(row.uploaded_by),
    uploadedAt: String(row.uploaded_at),
  };
}

function asAction(row: Record<string, unknown>): ObligationAction {
  return {
    id: String(row.id),
    obligationId: String(row.obligation_id),
    reviewId: row.review_id ? String(row.review_id) : undefined,
    title: String(row.title),
    description: String(row.description),
    owner: String(row.owner),
    dueDate: String(row.due_date),
    status: String(row.status) as ObligationAction["status"],
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class LegalRegisterRepository {
  constructor(private pool: Pool = pgPool) {}

  private shouldUseFallback(): boolean {
    return !(process.env.DATABASE_URL || process.env.DB_HOST || process.env.POSTGRES_URL);
  }

  private async withFallback<T>(
    fallback: () => T,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.shouldUseFallback()) {
      return fallback();
    }
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error("legal-register-repository-timeout")), 1500);
        }),
      ]);
    } catch {
      return fallback();
    }
  }

  async getDashboard(): Promise<LegalRegisterDashboard> {
    return this.withFallback(
      () => ({
        totalEntries: 0,
        activeEntries: 0,
        totalObligations: 0,
        obligationsByLifecycle: {},
        overdueObligations: 0,
        openReviews: 0,
        openActions: 0,
      }),
      async () => {
        const [entries, obligations, reviews, actions] = await Promise.all([
          this.pool.query("SELECT COUNT(*) AS count FROM legal_register_entries WHERE status = 'Active'"),
          this.pool.query("SELECT COUNT(*) AS count FROM legal_obligations"),
          this.pool.query("SELECT COUNT(*) AS count FROM obligation_reviews WHERE status IN ('Planned', 'In Progress')"),
          this.pool.query("SELECT COUNT(*) AS count FROM obligation_actions WHERE status IN ('Open', 'In Progress')"),
        ]);

        const lifecycleResult = await this.pool.query(
          "SELECT lifecycle, COUNT(*) AS count FROM legal_obligations GROUP BY lifecycle"
        );
        const obligationsByLifecycle = lifecycleResult.rows.reduce(
          (acc, row) => ({ ...acc, [String(row.lifecycle)]: Number(row.count) }),
          {} as Record<string, number>
        );

        const overdueResult = await this.pool.query(
          "SELECT COUNT(*) AS count FROM legal_obligations WHERE due_date < NOW() AND lifecycle NOT IN ('Closed', 'Implemented')"
        );

        return {
          totalEntries: Number(entries.rows[0]?.count ?? 0),
          activeEntries: Number(entries.rows[0]?.count ?? 0),
          totalObligations: Number(obligations.rows[0]?.count ?? 0),
          obligationsByLifecycle,
          overdueObligations: Number(overdueResult.rows[0]?.count ?? 0),
          openReviews: Number(reviews.rows[0]?.count ?? 0),
          openActions: Number(actions.rows[0]?.count ?? 0),
        };
      }
    );
  }

  async getRegisterEntries(filters?: Record<string, unknown>): Promise<LegalRegisterEntry[]> {
    return this.withFallback(
      () => [],
      async () => {
        const where: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              if (key === "title" || key === "legislation" || key === "jurisdiction") {
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

        const sql = `SELECT * FROM legal_register_entries ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asRegisterEntry(row as unknown as Record<string, unknown>));
      }
    );
  }

  async getRegisterEntryById(id: string): Promise<LegalRegisterEntry | null> {
    return this.withFallback(
      () => null,
      async () => {
        const result = await this.pool.query("SELECT * FROM legal_register_entries WHERE id = $1", [id]);
        return result.rows[0] ? asRegisterEntry(result.rows[0] as unknown as Record<string, unknown>) : null;
      }
    );
  }

  async createRegisterEntry(data: CreateLegalRegisterEntryInput): Promise<LegalRegisterEntry> {
    return this.withFallback(
      () => ({
        id: `LRE-${Date.now()}`,
        ...data,
        scope: data.scope ?? [],
        status: data.status ?? "Active",
        createdBy: data.createdBy,
        createdAt: now(),
        updatedAt: now(),
      } as LegalRegisterEntry),
      async () => {
        const result = await this.pool.query(
          `INSERT INTO legal_register_entries (id, title, legislation, jurisdiction, authority, effective_date, review_date, summary, scope, status, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
           RETURNING *`,
          [
            data.title,
            data.legislation,
            data.jurisdiction,
            data.authority,
            data.effectiveDate,
            data.reviewDate ?? null,
            data.summary,
            JSON.stringify(data.scope ?? []),
            data.status ?? "Active",
            data.createdBy,
            now(),
            now(),
          ]
        );
        return asRegisterEntry(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async updateRegisterEntry(id: string, data: UpdateLegalRegisterEntryInput): Promise<LegalRegisterEntry | null> {
    const existing = await this.getRegisterEntryById(id);
    if (!existing) return null;

    return this.withFallback(
      () => ({ ...existing, ...data, updatedAt: now() } as LegalRegisterEntry),
      async () => {
        const fields: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        const map: Record<string, string> = {
          title: "title",
          legislation: "legislation",
          jurisdiction: "jurisdiction",
          authority: "authority",
          effectiveDate: "effective_date",
          reviewDate: "review_date",
          summary: "summary",
          scope: "scope",
          status: "status",
        };

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const pgKey = map[key] || key;
            if (key === "scope") {
              fields.push(`${pgKey} = $${idx}::jsonb`);
              params.push(JSON.stringify(value));
            } else {
              fields.push(`${pgKey} = $${idx}`);
              params.push(value);
            }
            idx++;
          }
        });

        if (fields.length === 0) return existing;

        fields.push(`updated_at = $${idx}`);
        params.push(now(), id);

        const result = await this.pool.query(
          `UPDATE legal_register_entries SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
          params
        );
        return asRegisterEntry(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async deleteRegisterEntry(id: string): Promise<boolean> {
    const existing = await this.getRegisterEntryById(id);
    if (!existing) return false;

    return this.withFallback(
      () => {
        return true;
      },
      async () => {
        await this.pool.query("DELETE FROM legal_register_entries WHERE id = $1", [id]);
        return true;
      }
    );
  }

  async getObligations(filters?: Record<string, unknown>): Promise<LegalObligation[]> {
    return this.withFallback(
      () => [],
      async () => {
        const where: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              if (key === "title" || key === "requirement" || key === "site" || key === "department") {
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

        const sql = `SELECT * FROM legal_obligations ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asObligation(row as unknown as Record<string, unknown>));
      }
    );
  }

  async getObligationById(id: string): Promise<LegalObligation | null> {
    return this.withFallback(
      () => null,
      async () => {
        const result = await this.pool.query("SELECT * FROM legal_obligations WHERE id = $1", [id]);
        return result.rows[0] ? asObligation(result.rows[0] as unknown as Record<string, unknown>) : null;
      }
    );
  }

  async createObligation(data: CreateLegalObligationInput): Promise<LegalObligation> {
    return this.withFallback(
      () => ({
        id: `LOB-${Date.now()}`,
        ...data,
        lifecycle: data.lifecycle ?? "Draft",
        evidenceCount: 0,
        openActionsCount: 0,
        createdBy: data.createdBy,
        createdAt: now(),
        updatedAt: now(),
      } as LegalObligation),
      async () => {
        const result = await this.pool.query(
          `INSERT INTO legal_obligations (id, register_entry_id, title, requirement, frequency, responsibility, site, department, due_date, lifecycle, last_review_date, next_review_date, evidence_count, open_actions_count, notes, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           RETURNING *`,
          [
            data.registerEntryId,
            data.title,
            data.requirement,
            data.frequency,
            data.responsibility,
            data.site,
            data.department,
            data.dueDate ?? null,
            data.lifecycle ?? "Draft",
            data.lastReviewDate ?? null,
            data.nextReviewDate ?? null,
            0,
            0,
            data.notes ?? null,
            data.createdBy,
            now(),
            now(),
          ]
        );
        return asObligation(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async updateObligation(id: string, data: UpdateLegalObligationInput): Promise<LegalObligation | null> {
    const existing = await this.getObligationById(id);
    if (!existing) return null;

    return this.withFallback(
      () => ({ ...existing, ...data, updatedAt: now() } as LegalObligation),
      async () => {
        const fields: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        const map: Record<string, string> = {
          registerEntryId: "register_entry_id",
          title: "title",
          requirement: "requirement",
          frequency: "frequency",
          responsibility: "responsibility",
          site: "site",
          department: "department",
          dueDate: "due_date",
          lifecycle: "lifecycle",
          lastReviewDate: "last_review_date",
          nextReviewDate: "next_review_date",
          notes: "notes",
        };

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const pgKey = map[key] || key;
            fields.push(`${pgKey} = $${idx}`);
            params.push(value);
            idx++;
          }
        });

        if (fields.length === 0) return existing;

        fields.push(`updated_at = $${idx}`);
        params.push(now(), id);

        const result = await this.pool.query(
          `UPDATE legal_obligations SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
          params
        );
        return asObligation(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async deleteObligation(id: string): Promise<boolean> {
    const existing = await this.getObligationById(id);
    if (!existing) return false;

    return this.withFallback(
      () => true,
      async () => {
        await this.pool.query("DELETE FROM legal_obligations WHERE id = $1", [id]);
        return true;
      }
    );
  }

  async getReviews(filters?: Record<string, unknown>): Promise<ObligationReview[]> {
    return this.withFallback(
      () => [],
      async () => {
        const where: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              where.push(`${pgKey} = $${idx}`);
              params.push(value);
              idx++;
            }
          });
        }

        const sql = `SELECT * FROM obligation_reviews ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY review_date DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asReview(row as unknown as Record<string, unknown>));
      }
    );
  }

  async getReviewById(id: string): Promise<ObligationReview | null> {
    return this.withFallback(
      () => null,
      async () => {
        const result = await this.pool.query("SELECT * FROM obligation_reviews WHERE id = $1", [id]);
        return result.rows[0] ? asReview(result.rows[0] as unknown as Record<string, unknown>) : null;
      }
    );
  }

  async createReview(data: CreateObligationReviewInput): Promise<ObligationReview> {
    return this.withFallback(
      () => ({
        id: `REV-${Date.now()}`,
        ...data,
        status: data.status ?? "Planned",
        followUpRequired: data.followUpRequired ?? false,
        createdBy: data.createdBy,
        createdAt: now(),
        updatedAt: now(),
      } as ObligationReview),
      async () => {
        const result = await this.pool.query(
          `INSERT INTO obligation_reviews (id, obligation_id, title, status, review_date, reviewer, findings, conclusion, follow_up_required, follow_up_date, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            data.obligationId,
            data.title,
            data.status ?? "Planned",
            data.reviewDate,
            data.reviewer,
            data.findings,
            data.conclusion,
            data.followUpRequired ?? false,
            data.followUpDate ?? null,
            data.createdBy,
            now(),
            now(),
          ]
        );
        return asReview(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async updateReview(id: string, data: UpdateObligationReviewInput): Promise<ObligationReview | null> {
    const existing = await this.getReviewById(id);
    if (!existing) return null;

    return this.withFallback(
      () => ({ ...existing, ...data, updatedAt: now() } as ObligationReview),
      async () => {
        const fields: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        const map: Record<string, string> = {
          title: "title",
          status: "status",
          reviewDate: "review_date",
          reviewer: "reviewer",
          findings: "findings",
          conclusion: "conclusion",
          followUpRequired: "follow_up_required",
          followUpDate: "follow_up_date",
        };

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const pgKey = map[key] || key;
            fields.push(`${pgKey} = $${idx}`);
            params.push(value);
            idx++;
          }
        });

        if (fields.length === 0) return existing;

        fields.push(`updated_at = $${idx}`);
        params.push(now(), id);

        const result = await this.pool.query(
          `UPDATE obligation_reviews SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
          params
        );
        return asReview(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async deleteReview(id: string): Promise<boolean> {
    const existing = await this.getReviewById(id);
    if (!existing) return false;

    return this.withFallback(
      () => true,
      async () => {
        await this.pool.query("DELETE FROM obligation_reviews WHERE id = $1", [id]);
        return true;
      }
    );
  }

  async getEvidence(filters?: Record<string, unknown>): Promise<ObligationEvidence[]> {
    return this.withFallback(
      () => [],
      async () => {
        const where: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              where.push(`${pgKey} = $${idx}`);
              params.push(value);
              idx++;
            }
          });
        }

        const sql = `SELECT * FROM obligation_evidence ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY uploaded_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asEvidence(row as unknown as Record<string, unknown>));
      }
    );
  }

  async createEvidence(data: CreateObligationEvidenceInput): Promise<ObligationEvidence> {
    return this.withFallback(
      () => ({
        id: `EVD-${Date.now()}`,
        ...data,
        reviewId: data.reviewId,
        uploadedBy: data.uploadedBy,
        uploadedAt: now(),
      } as ObligationEvidence),
      async () => {
        const result = await this.pool.query(
          `INSERT INTO obligation_evidence (id, obligation_id, review_id, type, name, url, description, uploaded_by, uploaded_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            data.obligationId,
            data.reviewId ?? null,
            data.type,
            data.name,
            data.url,
            data.description ?? null,
            data.uploadedBy,
            now(),
          ]
        );
        return asEvidence(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async deleteEvidence(id: string): Promise<boolean> {
    return this.withFallback(
      () => true,
      async () => {
        await this.pool.query("DELETE FROM obligation_evidence WHERE id = $1", [id]);
        return true;
      }
    );
  }

  async getActions(filters?: Record<string, unknown>): Promise<ObligationAction[]> {
    return this.withFallback(
      () => [],
      async () => {
        const where: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
              where.push(`${pgKey} = $${idx}`);
              params.push(value);
              idx++;
            }
          });
        }

        const sql = `SELECT * FROM obligation_actions ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY due_date ASC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asAction(row as unknown as Record<string, unknown>));
      }
    );
  }

  async getActionById(id: string): Promise<ObligationAction | null> {
    return this.withFallback(
      () => null,
      async () => {
        const result = await this.pool.query("SELECT * FROM obligation_actions WHERE id = $1", [id]);
        return result.rows[0] ? asAction(result.rows[0] as unknown as Record<string, unknown>) : null;
      }
    );
  }

  async createAction(data: CreateObligationActionInput): Promise<ObligationAction> {
    return this.withFallback(
      () => ({
        id: `ACT-${Date.now()}`,
        ...data,
        reviewId: data.reviewId,
        status: data.status ?? "Open",
        createdBy: data.createdBy,
        createdAt: now(),
        updatedAt: now(),
      } as ObligationAction),
      async () => {
        const result = await this.pool.query(
          `INSERT INTO obligation_actions (id, obligation_id, review_id, title, description, owner, due_date, status, completed_at, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            data.obligationId,
            data.reviewId ?? null,
            data.title,
            data.description,
            data.owner,
            data.dueDate,
            data.status ?? "Open",
            null,
            data.createdBy,
            now(),
            now(),
          ]
        );
        return asAction(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async updateAction(id: string, data: UpdateObligationActionInput): Promise<ObligationAction | null> {
    const existing = await this.getActionById(id);
    if (!existing) return null;

    return this.withFallback(
      () => ({ ...existing, ...data, updatedAt: now() } as ObligationAction),
      async () => {
        const fields: string[] = [];
        const params: unknown[] = [];
        let idx = 1;

        const map: Record<string, string> = {
          title: "title",
          description: "description",
          owner: "owner",
          dueDate: "due_date",
          status: "status",
          completedAt: "completed_at",
        };

        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            const pgKey = map[key] || key;
            fields.push(`${pgKey} = $${idx}`);
            params.push(value);
            idx++;
          }
        });

        if (fields.length === 0) return existing;

        fields.push(`updated_at = $${idx}`);
        params.push(now(), id);

        const result = await this.pool.query(
          `UPDATE obligation_actions SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
          params
        );
        return asAction(result.rows[0] as unknown as Record<string, unknown>);
      }
    );
  }

  async deleteAction(id: string): Promise<boolean> {
    const existing = await this.getActionById(id);
    if (!existing) return false;

    return this.withFallback(
      () => true,
      async () => {
        await this.pool.query("DELETE FROM obligation_actions WHERE id = $1", [id]);
        return true;
      }
    );
  }
}
