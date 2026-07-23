import { allRows, getDb, saveDb } from "../../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";

const now = () => new Date().toISOString();

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

export class AiRepository {
  async savePrediction(
    feature: string,
    inputHash: string,
    output: any,
    modelVersion: string,
    confidence: number,
    userId?: string,
  ) {
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
    const db = await getDb();
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
