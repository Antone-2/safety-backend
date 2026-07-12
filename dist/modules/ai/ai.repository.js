import { allRows, getDb, saveDb } from "../../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
const now = () => new Date().toISOString();
export class AiRepository {
    async savePrediction(feature, inputHash, output, modelVersion, confidence, userId) {
        const db = await getDb();
        const id = uuidv4();
        db.prepare(`INSERT INTO ai_predictions (id, feature, input_hash, output_json, model_version, confidence, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run([
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
    async getPrediction(id) {
        const db = await getDb();
        const row = db
            .prepare("SELECT * FROM ai_predictions WHERE id = ?")
            .getAsObject([id]);
        return row
            ? { ...row, output_json: JSON.parse(row.output_json || "{}") }
            : null;
    }
    async listPredictions(filters) {
        const db = await getDb();
        let sql = "SELECT * FROM ai_predictions WHERE 1=1";
        const params = [];
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
        const rows = allRows(db, sql, params);
        return rows.map((r) => ({
            ...r,
            output_json: JSON.parse(r.output_json || "{}"),
        }));
    }
    async saveDocument(document) {
        const db = await getDb();
        const id = uuidv4();
        db.prepare(`INSERT INTO ai_documents (id, title, content, embedding, category, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run([
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
    async listDocuments(filters) {
        const db = await getDb();
        let sql = "SELECT * FROM ai_documents WHERE 1=1";
        const params = [];
        if (filters?.category) {
            sql += ` AND category = ?`;
            params.push(filters.category);
        }
        sql += " ORDER BY created_at DESC";
        if (filters?.limit) {
            sql += ` LIMIT ?`;
            params.push(filters.limit);
        }
        return allRows(db, sql, params);
    }
    async saveKnowledgeChunk(chunk) {
        const db = await getDb();
        const id = uuidv4();
        db.prepare(`INSERT INTO ai_knowledge_base (id, chunk_text, embedding, source_document_id, section, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run([
            id,
            chunk.chunkText,
            chunk.embedding || "",
            chunk.sourceDocumentId || null,
            chunk.section || null,
            now(),
        ]);
        return id;
    }
    async listKnowledgeChunks(filters) {
        const db = await getDb();
        let sql = "SELECT * FROM ai_knowledge_base WHERE 1=1";
        const params = [];
        if (filters?.sourceDocumentId) {
            sql += ` AND source_document_id = ?`;
            params.push(filters.sourceDocumentId);
        }
        sql += " ORDER BY created_at DESC";
        if (filters?.limit) {
            sql += ` LIMIT ?`;
            params.push(filters.limit);
        }
        return allRows(db, sql, params);
    }
    async saveFeedback(feedback) {
        const db = await getDb();
        const id = uuidv4();
        db.prepare(`INSERT INTO ai_feedback (id, feature, prediction_id, user_id, rating, feedback_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run([
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
    async getFeedbackStats(feature) {
        const db = await getDb();
        const sql = feature
            ? "SELECT feature, AVG(rating) as avgRating, COUNT(*) as count FROM ai_feedback WHERE feature = ? GROUP BY feature"
            : "SELECT feature, AVG(rating) as avgRating, COUNT(*) as count FROM ai_feedback GROUP BY feature";
        const params = feature ? [feature] : [];
        const rows = allRows(db, sql, params);
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
            .getAsObject(["default"]);
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
            allowedRoles: JSON.parse(row.allowedRoles || "[]"),
            ragSources: JSON.parse(row.ragSources || "[]"),
        };
    }
    async updateGuardrailSettings(data, updatedBy) {
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
        db.prepare(`INSERT OR REPLACE INTO ai_guardrail_settings
       (id, enabled, requireCitations, allowExports, maxSourceRecords, allowedRoles, ragSources, updatedBy, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
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
    async savePromptAudit(input) {
        const db = await getDb();
        const id = uuidv4();
        db.prepare(`INSERT INTO ai_prompt_audit
       (id, userId, userEmail, userRole, feature, promptHash, promptExcerpt, responseSummary, modelVersion, confidence, sources, warnings, denied, denialReason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
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
    async listPromptAudit(filters) {
        const db = await getDb();
        let sql = "SELECT * FROM ai_prompt_audit WHERE 1=1";
        const params = [];
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
        return allRows(db, sql, params).map((row) => ({
            ...row,
            sources: JSON.parse(row.sources || "[]"),
            warnings: JSON.parse(row.warnings || "[]"),
            denied: Boolean(row.denied),
        }));
    }
}
