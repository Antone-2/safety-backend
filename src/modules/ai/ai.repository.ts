import { allRows, getDb, saveDb } from "../../lib/database.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";

const now = () => new Date().toISOString();

function isPgAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function parseJsonArray(value: unknown, fallback: string[]) {
  if (!value || typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJson(value: unknown, fallback: any) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapGuardrailRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    enabled: Boolean(row.enabled),
    requireCitations: Boolean(row.require_citations ?? row.requireCitations),
    allowExports: Boolean(row.allow_exports ?? row.allowExports),
    maxSourceRecords: Number(row.max_source_records ?? row.maxSourceRecords ?? 50),
    allowedRoles: parseJsonArray(row.allowed_roles ?? row.allowedRoles, [
      "super-admin",
      "EHS-manager",
      "hse-officer",
      "plant-manager",
      "factory-manager",
    ]),
    ragSources: parseJsonArray(row.rag_sources ?? row.ragSources, [
      "policies",
      "procedures",
      "reports",
      "capa",
      "audits",
      "training",
    ]),
    updatedBy: (row.updated_by ?? row.updatedBy) as string | null | undefined,
    updatedAt: (row.updated_at ?? row.updatedAt) as string | undefined,
  };
}

function mapPromptAuditRow(row: Record<string, unknown>) {
  return {
    ...row,
    userId: row.user_id as string | undefined,
    userEmail: row.user_email as string | undefined,
    userRole: row.user_role as string | undefined,
    feature: row.feature as string,
    promptHash: row.prompt_hash as string,
    promptExcerpt: row.prompt_excerpt as string,
    responseSummary: row.response_summary as string | undefined,
    modelVersion: row.model_version as string,
    confidence: row.confidence as number | undefined,
    sources: parseJsonArray(row.sources, []),
    warnings: parseJsonArray(row.warnings, []),
    denied: Boolean(row.denied),
    denialReason: row.denial_reason as string | undefined,
    createdAt: row.created_at as string,
  };
}

export class AiRepository {
  async savePrediction(
    feature: string,
    inputHash: string,
    output: any,
    modelVersion: string,
    confidence: number,
    userId?: string,
  ) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        `INSERT INTO ai_predictions (feature, input_hash, output_json, model_version, confidence, user_id, created_at) VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW()) RETURNING id`,
        [feature, inputHash, JSON.stringify(output), modelVersion, confidence, userId ?? null],
      );
      return result.rows[0]?.id as string;
    }

    const db = await getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO ai_predictions (id, feature, input_hash, output_json, model_version, confidence, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      id,
      feature,
      inputHash,
      JSON.stringify(output),
      modelVersion,
      confidence,
      userId ?? null,
      now(),
    ]);
    return id;
  }

  async getPrediction(id: string) {
    if (isPgAvailable()) {
      const result = await pgPool.query("SELECT * FROM ai_predictions WHERE id = $1 LIMIT 1", [id]);
      const row = result.rows[0];
      return row ? { ...row, output_json: parseJson(row.output_json, {}) } : null;
    }

    const db = await getDb();
    const row = db
      .prepare("SELECT * FROM ai_predictions WHERE id = ?")
      .getAsObject([id]) as any;
    return row
      ? { ...row, output_json: parseJson(row.output_json, {}) }
      : null;
  }

  async listPredictions(filters?: {
    feature?: string;
    userId?: string;
    limit?: number;
  }) {
    if (isPgAvailable()) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (filters?.feature) {
        params.push(filters.feature);
        where.push(`feature = $${params.length}`);
      }
      if (filters?.userId) {
        params.push(filters.userId);
        where.push(`user_id = $${params.length}`);
      }
      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      params.push(filters?.limit ?? 100);
      const result = await pgPool.query(
        `SELECT * FROM ai_predictions${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows.map((r) => ({
        ...r,
        output_json: parseJson(r.output_json, {}),
      }));
    }

    const db = await getDb();
    let sql = "SELECT * FROM ai_predictions WHERE 1=1";
    const params: any[] = [];
    if (filters?.feature) {
      sql += ` AND feature = ?`;
      params.push(filters.feature);
    }
    if (filters?.userId) {
      sql += ` AND user_id = ?`;
      params.push(filters.userId);
    }
    sql += " ORDER BY created_at DESC";
    if (filters?.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }
    const rows = allRows(db, sql, params) as any[];
    return rows.map((r) => ({
      ...r,
      output_json: parseJson(r.output_json, {}),
    }));
  }

  async saveDocument(document: {
    title: string;
    content: string;
    category: string;
    source: string;
    embedding?: string;
  }) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        `INSERT INTO ai_documents (id, title, content, embedding, category, source, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
        [uuidv4(), document.title, document.content, document.embedding || "", document.category, document.source],
      );
      return result.rows[0]?.id as string;
    }

    const db = await getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO ai_documents (id, title, content, embedding, category, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      id,
      document.title,
      document.content,
      document.embedding || "",
      document.category,
      document.source,
      now(),
      now(),
    ]);
    return id;
  }

  async listDocuments(filters?: { category?: string; limit?: number }) {
    if (isPgAvailable()) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (filters?.category) {
        params.push(filters.category);
        where.push(`category = $${params.length}`);
      }
      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      params.push(filters?.limit ?? 100);
      const result = await pgPool.query(
        `SELECT * FROM ai_documents${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows;
    }

    const db = await getDb();
    let sql = "SELECT * FROM ai_documents WHERE 1=1";
    const params: any[] = [];
    if (filters?.category) {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }
    sql += " ORDER BY created_at DESC";
    if (filters?.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }
    return allRows(db, sql, params) as any[];
  }

  async saveKnowledgeChunk(chunk: {
    chunkText: string;
    embedding?: string;
    sourceDocumentId?: string;
    section?: string;
  }) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        `INSERT INTO ai_knowledge_base (id, chunk_text, embedding, source_document_id, section, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
        [uuidv4(), chunk.chunkText, chunk.embedding || "", chunk.sourceDocumentId || null, chunk.section || null],
      );
      return result.rows[0]?.id as string;
    }

    const db = await getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO ai_knowledge_base (id, chunk_text, embedding, source_document_id, section, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run([
      id,
      chunk.chunkText,
      chunk.embedding || "",
      chunk.sourceDocumentId || null,
      chunk.section || null,
      now(),
    ]);
    return id;
  }

  async listKnowledgeChunks(filters?: {
    sourceDocumentId?: string;
    limit?: number;
  }) {
    if (isPgAvailable()) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (filters?.sourceDocumentId) {
        params.push(filters.sourceDocumentId);
        where.push(`source_document_id = $${params.length}`);
      }
      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      params.push(filters?.limit ?? 100);
      const result = await pgPool.query(
        `SELECT * FROM ai_knowledge_base${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows;
    }

    const db = await getDb();
    let sql = "SELECT * FROM ai_knowledge_base WHERE 1=1";
    const params: any[] = [];
    if (filters?.sourceDocumentId) {
      sql += ` AND source_document_id = ?`;
      params.push(filters.sourceDocumentId);
    }
    sql += " ORDER BY created_at DESC";
    if (filters?.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }
    return allRows(db, sql, params) as any[];
  }

  async saveFeedback(feedback: {
    feature: string;
    predictionId?: string;
    userId: string;
    rating: number;
    feedbackText?: string;
  }) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        `INSERT INTO ai_feedback (id, feature, prediction_id, user_id, rating, feedback_text, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [uuidv4(), feedback.feature, feedback.predictionId || null, feedback.userId, feedback.rating, feedback.feedbackText || null],
      );
      return result.rows[0]?.id as string;
    }

    const db = await getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO ai_feedback (id, feature, prediction_id, user_id, rating, feedback_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      id,
      feedback.feature,
      feedback.predictionId || null,
      feedback.userId,
      feedback.rating,
      feedback.feedbackText || null,
      now(),
    ]);
    return id;
  }

  async getFeedbackStats(feature?: string) {
    if (isPgAvailable()) {
      const params: unknown[] = [];
      const where = feature ? ` WHERE feature = $1` : "";
      if (feature) params.push(feature);
      const result = await pgPool.query(
        `SELECT feature, AVG(rating)::float8 as avgRating, COUNT(*)::int as count FROM ai_feedback${where} GROUP BY feature`,
        params,
      );
      return result.rows.map((r) => ({
        feature: r.feature,
        avgRating: Number(r.avgRating),
        count: Number(r.count),
      }));
    }

    const db = await getDb();
    const sql = feature
      ? "SELECT feature, AVG(rating) as avgRating, COUNT(*) as count FROM ai_feedback WHERE feature = ? GROUP BY feature"
      : "SELECT feature, AVG(rating) as avgRating, COUNT(*) as count FROM ai_feedback GROUP BY feature";
    const params = feature ? [feature] : [];
    const rows = allRows(db, sql, params) as any[];
    return rows.map((r) => ({
      feature: r.feature,
      avgRating: Number(r.avgRating),
      count: Number(r.count),
    }));
  }

  async getGuardrailSettings() {
    if (isPgAvailable()) {
      const result = await pgPool.query("SELECT * FROM ai_guardrail_settings WHERE id = $1 LIMIT 1", ["default"]);
      const row = result.rows[0];
      if (!row?.id) {
        return {
          id: "default",
          enabled: true,
          requireCitations: true,
          allowExports: true,
          maxSourceRecords: 50,
          allowedRoles: [
            "super-admin",
            "EHS-manager",
            "hse-officer",
            "plant-manager",
            "factory-manager",
          ],
          ragSources: [
            "policies",
            "procedures",
            "reports",
            "capa",
            "audits",
            "training",
          ],
        };
      }
      return mapGuardrailRow(row);
    }

    const db = await getDb();
    const row = db
      .prepare("SELECT * FROM ai_guardrail_settings WHERE id = ?")
      .getAsObject(["default"]) as any;
    if (!row?.id) {
      return {
        id: "default",
        enabled: true,
        requireCitations: true,
        allowExports: true,
        maxSourceRecords: 50,
        allowedRoles: [
          "super-admin",
          "EHS-manager",
          "hse-officer",
          "plant-manager",
          "factory-manager",
        ],
        ragSources: [
          "policies",
          "procedures",
          "reports",
          "capa",
          "audits",
          "training",
        ],
      };
    }
    return {
      ...row,
      enabled: Boolean(row.enabled),
      requireCitations: Boolean(row.requireCitations),
      allowExports: Boolean(row.allowExports),
      maxSourceRecords: Number(row.maxSourceRecords || 50),
      allowedRoles: parseJsonArray(row.allowedRoles, [
        "super-admin",
        "EHS-manager",
        "hse-officer",
        "plant-manager",
        "factory-manager",
      ]),
      ragSources: parseJsonArray(row.ragSources, [
        "policies",
        "procedures",
        "reports",
        "capa",
        "audits",
        "training",
      ]),
    };
  }

  async updateGuardrailSettings(data: Record<string, any>, updatedBy?: string) {
    const existing = await this.getGuardrailSettings();
    const next = {
      enabled: data.enabled ?? existing.enabled,
      requireCitations: data.requireCitations ?? existing.requireCitations,
      allowExports: data.allowExports ?? existing.allowExports,
      maxSourceRecords: data.maxSourceRecords ?? existing.maxSourceRecords,
      allowedRoles: data.allowedRoles ?? existing.allowedRoles,
      ragSources: data.ragSources ?? existing.ragSources,
      updatedBy: updatedBy ?? existing.updatedBy ?? null,
      updatedAt: now(),
    };

    if (isPgAvailable()) {
      await pgPool.query(
        `INSERT INTO ai_guardrail_settings (id, enabled, require_citations, allow_exports, max_source_records, allowed_roles, rag_sources, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9) ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, require_citations = EXCLUDED.require_citations, allow_exports = EXCLUDED.allow_exports, max_source_records = EXCLUDED.max_source_records, allowed_roles = EXCLUDED.allowed_roles, rag_sources = EXCLUDED.rag_sources, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
        [
          "default",
          next.enabled,
          next.requireCitations,
          next.allowExports,
          Number(next.maxSourceRecords),
          JSON.stringify(next.allowedRoles),
          JSON.stringify(next.ragSources),
          next.updatedBy,
          next.updatedAt,
        ],
      );
      return this.getGuardrailSettings();
    }

    const db = await getDb();
    db.prepare(
      `INSERT OR REPLACE INTO ai_guardrail_settings
       (id, enabled, requireCitations, allowExports, maxSourceRecords, allowedRoles, ragSources, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      "default",
      next.enabled ? 1 : 0,
      next.requireCitations ? 1 : 0,
      next.allowExports ? 1 : 0,
      Number(next.maxSourceRecords),
      JSON.stringify(next.allowedRoles),
      JSON.stringify(next.ragSources),
      next.updatedBy,
      next.updatedAt,
    ]);
    await saveDb(db);
    return this.getGuardrailSettings();
  }

  async savePromptAudit(input: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    feature: string;
    prompt: string;
    responseSummary?: string;
    modelVersion: string;
    confidence?: number;
    sources?: string[];
    warnings?: string[];
    denied?: boolean;
    denialReason?: string;
  }) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        `INSERT INTO ai_prompt_audit (user_id, user_email, user_role, feature, prompt_hash, prompt_excerpt, response_summary, model_version, confidence, sources, warnings, denied, denial_reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, NOW()) RETURNING id`,
        [
          input.userId ?? null,
          input.userEmail ?? null,
          input.userRole ?? null,
          input.feature,
          createHash("sha256").update(input.prompt).digest("hex"),
          input.prompt.slice(0, 500),
          input.responseSummary ?? null,
          input.modelVersion,
          input.confidence ?? null,
          JSON.stringify(input.sources ?? []),
          JSON.stringify(input.warnings ?? []),
          input.denied ?? false,
          input.denialReason ?? null,
        ],
      );
      return result.rows[0]?.id as string;
    }

    const db = await getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO ai_prompt_audit
       (id, userId, userEmail, userRole, feature, promptHash, promptExcerpt, responseSummary, modelVersion, confidence, sources, warnings, denied, denialReason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      id,
      input.userId ?? null,
      input.userEmail ?? null,
      input.userRole ?? null,
      input.feature,
      createHash("sha256").update(input.prompt).digest("hex"),
      input.prompt.slice(0, 500),
      input.responseSummary ?? null,
      input.modelVersion,
      input.confidence ?? null,
      JSON.stringify(input.sources ?? []),
      JSON.stringify(input.warnings ?? []),
      input.denied ? 1 : 0,
      input.denialReason ?? null,
      now(),
    ]);
    await saveDb(db);
    return id;
  }

  async listPromptAudit(filters?: {
    feature?: string;
    userId?: string;
    limit?: number;
  }) {
    if (isPgAvailable()) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (filters?.feature) {
        params.push(filters.feature);
        where.push(`feature = $${params.length}`);
      }
      if (filters?.userId) {
        params.push(filters.userId);
        where.push(`user_id = $${params.length}`);
      }
      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      params.push(filters?.limit ?? 100);
      const result = await pgPool.query(
        `SELECT * FROM ai_prompt_audit${whereSql} ORDER BY created_at DESC LIMIT $${params.length}`,
        params,
      );
      return result.rows.map(mapPromptAuditRow);
    }

    const db = await getDb();
    let sql = "SELECT * FROM ai_prompt_audit WHERE 1=1";
    const params: any[] = [];
    if (filters?.feature) {
      sql += " AND feature = ?";
      params.push(filters.feature);
    }
    if (filters?.userId) {
      sql += " AND userId = ?";
      params.push(filters.userId);
    }
    sql += " ORDER BY createdAt DESC LIMIT ?";
    params.push(filters?.limit ?? 100);
    return (allRows(db, sql, params) as any[]).map((row) => ({
      ...row,
      sources: parseJsonArray(row.sources, []),
      warnings: parseJsonArray(row.warnings, []),
      denied: Boolean(row.denied),
    }));
  }
}
