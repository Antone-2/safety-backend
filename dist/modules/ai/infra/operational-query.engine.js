import { pgPool } from "../../../shared/infrastructure/database/postgres.client.js";
import { TrainingRepository } from "../../training/training.repository.js";
import { TrainingService } from "../../training/training.service.js";
import { PermitsRepository } from "../../permits/permits.repository.js";
import { PermitsService } from "../../permits/permits.service.js";
function requireCitations(settings) {
    return Boolean(settings.requireCitations ?? settings.requireCitation ?? true);
}
export function detectAiQueryDomain(query) {
    const text = query.toLowerCase();
    if (/permit|ptw|permit to work|hot work|confined space|electrical permit|excavation permit|height work permit|approval stage|permit expiry|expired permit/.test(text)) {
        return "permits";
    }
    if (/capa|corrective action|preventive action|action plan|follow-up action|follow up action|overdue action|closure action/.test(text)) {
        return "capa";
    }
    if (/training|course|certificate|competency|trainer|attendance|expiry|expired training|matrix/.test(text)) {
        return "training";
    }
    return "reports";
}
function compactTrainingRecord(record) {
    return {
        id: String(record.id ?? ""),
        employeeName: String(record.employeeName ?? record.employee_name ?? ""),
        department: String(record.department ?? ""),
        site: String(record.site ?? ""),
        status: String(record.status ?? ""),
        scheduledDate: String(record.scheduledDate ?? record.scheduled_date ?? ""),
        completedDate: record.completedDate ?? record.completed_date ?? undefined,
        expiryDate: record.expiryDate ?? record.expiry_date ?? undefined,
        trainer: record.trainer ?? undefined,
    };
}
export class OperationalQueryEngine {
    deps;
    training = new TrainingService(new TrainingRepository(pgPool));
    permits = new PermitsService(new PermitsRepository(pgPool));
    handlers;
    constructor(deps) {
        this.deps = deps;
        this.handlers = {
            training: {
                domain: "training",
                execute: (input) => this.executeTrainingQuery(input),
            },
            capa: {
                domain: "capa",
                execute: (input) => this.executeCapaQuery(input),
            },
            permits: {
                domain: "permits",
                execute: (input) => this.executePermitsQuery(input),
            },
        };
    }
    async executeDomainQuery(domain, input) {
        return this.handlers[domain].execute(input);
    }
    async executeTrainingQuery(input) {
        const text = input.governedInput.query.toLowerCase();
        const trainingFilters = {};
        const inferredConstraints = [];
        if (input.governedInput.filters?.department) {
            trainingFilters.department = input.governedInput.filters.department;
        }
        if (/\bcompleted\b/.test(text)) {
            trainingFilters.status = "Completed";
            inferredConstraints.push("Filtered training records to completed status.");
        }
        else if (/\bscheduled\b/.test(text)) {
            trainingFilters.status = "Scheduled";
            inferredConstraints.push("Filtered training records to scheduled status.");
        }
        else if (/\bexpired\b/.test(text)) {
            trainingFilters.status = "Expired";
            inferredConstraints.push("Filtered training records to expired status.");
        }
        const [stats, records] = await Promise.all([
            this.training.getStats(),
            this.training.getRecords(trainingFilters).catch(() => []),
        ]);
        const scopedRecords = records.slice(0, input.governedInput.maxSourceRecords);
        const trustedContext = {
            question: input.governedInput.query,
            actorRole: input.role,
            filters: input.governedInput.filters || {},
            inferredConstraints,
            trainingStats: stats,
            matchingRecords: scopedRecords.map(compactTrainingRecord),
        };
        const assistantAnswer = await this.deps.llm.generate("You are Crown Safety Training AI. Answer only from the trusted training context provided. Do not invent employee completions, expiries, or counts. Cite training record IDs inline when making factual claims.", [
            `User question: ${input.governedInput.query}`,
            `Trusted training context JSON: ${JSON.stringify(trustedContext)}`,
            "Return a concise operational answer with evidence and next actions.",
        ].join("\n\n"), { temperature: 0.1, maxTokens: 700 });
        const output = {
            success: true,
            data: {
                title: "AI Training Intelligence Report",
                query: input.governedInput.query,
                generatedAt: new Date().toISOString(),
                assistantAnswer,
                summary: stats,
                matchingRecords: scopedRecords.map(compactTrainingRecord),
                sources: scopedRecords.map((record) => String(record.id ?? "")).filter(Boolean),
                assumptions: [
                    "The answer is limited to training records available in the backend.",
                    "Training evidence was filtered before LLM generation.",
                    ...inferredConstraints,
                ],
                queryPlan: {
                    strategy: "sql-first-evidence-bound-answering",
                    planner: "training-domain-router",
                    domain: "training",
                    filtersApplied: trainingFilters,
                    inferredConstraints,
                },
                trustedContext,
            },
            metadata: {
                feature: "ai-query",
                domain: "training",
                confidence: scopedRecords.length > 0 ? 0.86 : 0.68,
                confidenceLevel: scopedRecords.length > 0 ? "high" : "medium",
                modelVersion: this.deps.model,
                processingTimeMs: Date.now() - input.startedAt,
                sources: scopedRecords.map((record) => String(record.id ?? "")).filter(Boolean),
                warnings: ["Training answers are based on backend training records and summary stats."],
                guardrails: {
                    permissionAware: true,
                    role: input.role,
                    requireCitations: requireCitations(input.settings),
                    ragSources: input.settings.ragSources,
                    exportsAllowed: Boolean(input.settings.allowExports),
                    maxSourceRecords: input.governedInput.maxSourceRecords,
                },
                execution: {
                    mode: "sql-first",
                    domain: "training",
                    primaryStore: "postgresql",
                    citedRecordCount: scopedRecords.length,
                },
            },
        };
        await this.deps.savePrediction("ai-query", input.governedInput, output, Number(output.metadata.confidence), input.user?.id);
        await this.deps.savePromptAudit({
            feature: "ai-query",
            prompt: input.prompt,
            output,
            confidence: Number(output.metadata.confidence),
            user: input.user,
        });
        return output;
    }
    async executeCapaQuery(input) {
        const text = input.governedInput.query.toLowerCase();
        const where = ["1=1"];
        const params = [];
        let idx = 1;
        const inferredConstraints = [];
        if (input.governedInput.filters?.department) {
            where.push(`department = $${idx++}`);
            params.push(input.governedInput.filters.department);
        }
        if (input.governedInput.filters?.location) {
            where.push(`site = $${idx++}`);
            params.push(input.governedInput.filters.location);
        }
        if (/\boverdue\b/.test(text)) {
            where.push(`status NOT IN ('Cancelled', 'Completed')`);
            where.push(`due_date < NOW()`);
            inferredConstraints.push("Filtered CAPA records to overdue actions.");
        }
        else if (/in progress/.test(text)) {
            where.push(`status = $${idx++}`);
            params.push("In Progress");
            inferredConstraints.push("Filtered CAPA records to in-progress actions.");
        }
        else if (/\bopen\b/.test(text)) {
            where.push(`status = $${idx++}`);
            params.push("Open");
            inferredConstraints.push("Filtered CAPA records to open actions.");
        }
        else if (/\bcompleted\b/.test(text)) {
            where.push(`status = $${idx++}`);
            params.push("Completed");
            inferredConstraints.push("Filtered CAPA records to completed actions.");
        }
        const whereSql = where.join(" AND ");
        const [summaryResult, recordsResult] = await Promise.all([
            pgPool.query(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
           COUNT(*) FILTER (WHERE status = 'In Progress')::int AS "inProgress",
           COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
           COUNT(*) FILTER (WHERE status NOT IN ('Cancelled', 'Completed') AND due_date < NOW())::int AS overdue
         FROM capa
         WHERE ${whereSql}`, params),
            pgPool.query(`SELECT id, capa_no, title, type, status, priority, owner, department, site, due_date, source, action_plan
         FROM capa
         WHERE ${whereSql}
         ORDER BY due_date ASC NULLS LAST, updated_at DESC
         LIMIT $${idx}`, [...params, input.governedInput.maxSourceRecords]),
        ]);
        const summary = summaryResult.rows[0] ?? {
            total: 0,
            open: 0,
            inProgress: 0,
            completed: 0,
            overdue: 0,
        };
        const matchingRecords = recordsResult.rows.map((row) => ({
            id: String(row.id),
            capaNo: row.capa_no ? String(row.capa_no) : undefined,
            title: String(row.title ?? ""),
            type: String(row.type ?? ""),
            status: String(row.status ?? ""),
            priority: String(row.priority ?? ""),
            owner: String(row.owner ?? ""),
            department: String(row.department ?? ""),
            site: String(row.site ?? ""),
            dueDate: row.due_date instanceof Date ? row.due_date.toISOString() : row.due_date,
            source: row.source ? String(row.source) : undefined,
            actionPlan: row.action_plan ? String(row.action_plan).slice(0, 240) : undefined,
        }));
        const trustedContext = {
            question: input.governedInput.query,
            actorRole: input.role,
            filters: input.governedInput.filters || {},
            inferredConstraints,
            capaSummary: {
                total: Number(summary.total ?? 0),
                open: Number(summary.open ?? 0),
                inProgress: Number(summary.inProgress ?? 0),
                completed: Number(summary.completed ?? 0),
                overdue: Number(summary.overdue ?? 0),
            },
            matchingRecords,
        };
        const assistantAnswer = await this.deps.llm.generate("You are Crown Safety CAPA AI. Answer only from the trusted CAPA context provided. Do not invent actions, owners, due dates, or closure states. Cite CAPA IDs inline when making factual claims.", [
            `User question: ${input.governedInput.query}`,
            `Trusted CAPA context JSON: ${JSON.stringify(trustedContext)}`,
            "Return a concise operational answer with evidence, overdue risk, and next actions.",
        ].join("\n\n"), { temperature: 0.1, maxTokens: 700 });
        const output = {
            success: true,
            data: {
                title: "AI CAPA Intelligence Report",
                query: input.governedInput.query,
                generatedAt: new Date().toISOString(),
                assistantAnswer,
                summary: trustedContext.capaSummary,
                matchingRecords,
                sources: matchingRecords.map((record) => record.id).filter(Boolean),
                assumptions: [
                    "The answer is limited to CAPA records available in the backend.",
                    "CAPA evidence was filtered before LLM generation.",
                    ...inferredConstraints,
                ],
                queryPlan: {
                    strategy: "sql-first-evidence-bound-answering",
                    planner: "capa-domain-router",
                    domain: "capa",
                    filtersApplied: input.governedInput.filters || {},
                    inferredConstraints,
                },
                trustedContext,
            },
            metadata: {
                feature: "ai-query",
                domain: "capa",
                confidence: matchingRecords.length > 0 ? 0.88 : 0.66,
                confidenceLevel: matchingRecords.length > 0 ? "high" : "medium",
                modelVersion: this.deps.model,
                processingTimeMs: Date.now() - input.startedAt,
                sources: matchingRecords.map((record) => record.id).filter(Boolean),
                warnings: ["CAPA answers are based on backend CAPA records and summary counts."],
                guardrails: {
                    permissionAware: true,
                    role: input.role,
                    requireCitations: requireCitations(input.settings),
                    ragSources: input.settings.ragSources,
                    exportsAllowed: Boolean(input.settings.allowExports),
                    maxSourceRecords: input.governedInput.maxSourceRecords,
                },
                execution: {
                    mode: "sql-first",
                    domain: "capa",
                    primaryStore: "postgresql",
                    citedRecordCount: matchingRecords.length,
                },
            },
        };
        await this.deps.savePrediction("ai-query", input.governedInput, output, Number(output.metadata.confidence), input.user?.id);
        await this.deps.savePromptAudit({
            feature: "ai-query",
            prompt: input.prompt,
            output,
            confidence: Number(output.metadata.confidence),
            user: input.user,
        });
        return output;
    }
    async executePermitsQuery(input) {
        const text = input.governedInput.query.toLowerCase();
        const filters = {};
        const inferredConstraints = [];
        if (input.governedInput.filters?.location) {
            filters.location = input.governedInput.filters.location;
        }
        if (/hot work/.test(text)) {
            filters.type = "Hot Work";
            inferredConstraints.push("Filtered permits to Hot Work.");
        }
        else if (/confined space/.test(text)) {
            filters.type = "Confined Space";
            inferredConstraints.push("Filtered permits to Confined Space.");
        }
        else if (/electrical/.test(text)) {
            filters.type = "Electrical";
            inferredConstraints.push("Filtered permits to Electrical.");
        }
        else if (/excavation/.test(text)) {
            filters.type = "Excavation";
            inferredConstraints.push("Filtered permits to Excavation.");
        }
        else if (/height work/.test(text)) {
            filters.type = "Height Work";
            inferredConstraints.push("Filtered permits to Height Work.");
        }
        if (/expired/.test(text)) {
            filters.status = "expired";
            inferredConstraints.push("Filtered permits to expired status.");
        }
        else if (/active|valid/.test(text)) {
            filters.status = "active";
            inferredConstraints.push("Filtered permits to active status.");
        }
        else if (/approval/.test(text)) {
            filters.status = "approval";
            inferredConstraints.push("Filtered permits to approval stage.");
        }
        const allPermits = await this.permits.getPermits(filters).catch(() => []);
        const nowIso = new Date().toISOString();
        const matchingPermits = allPermits
            .filter((permit) => {
            if (/expired/.test(text)) {
                return String(permit.endDate ?? "") < nowIso;
            }
            if (/expiring|due soon|ending soon/.test(text)) {
                const endDate = new Date(String(permit.endDate ?? ""));
                const daysUntilEnd = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
                return daysUntilEnd >= 0 && daysUntilEnd <= 7;
            }
            return true;
        })
            .slice(0, input.governedInput.maxSourceRecords);
        const summary = {
            total: matchingPermits.length,
            active: matchingPermits.filter((permit) => permit.status === "active").length,
            expired: matchingPermits.filter((permit) => permit.status === "expired" || String(permit.endDate ?? "") < nowIso).length,
            approval: matchingPermits.filter((permit) => permit.status === "approval").length,
            draft: matchingPermits.filter((permit) => permit.status === "draft").length,
        };
        const trustedContext = {
            question: input.governedInput.query,
            actorRole: input.role,
            filters: input.governedInput.filters || {},
            inferredConstraints,
            permitSummary: summary,
            matchingPermits: matchingPermits.map((permit) => ({
                id: String(permit.id ?? ""),
                type: String(permit.type ?? ""),
                status: String(permit.status ?? ""),
                location: String(permit.location ?? ""),
                applicant: String(permit.applicant ?? ""),
                startDate: String(permit.startDate ?? ""),
                endDate: String(permit.endDate ?? ""),
                approver: permit.approver ? String(permit.approver) : undefined,
                description: String(permit.description ?? "").slice(0, 220),
            })),
        };
        const assistantAnswer = await this.deps.llm.generate("You are Crown Safety Permit AI. Answer only from the trusted permit context provided. Do not invent permit status, dates, locations, or approvers. Cite permit IDs inline when making factual claims.", [
            `User question: ${input.governedInput.query}`,
            `Trusted permit context JSON: ${JSON.stringify(trustedContext)}`,
            "Return a concise operational answer with evidence and next actions.",
        ].join("\n\n"), { temperature: 0.1, maxTokens: 700 });
        const output = {
            success: true,
            data: {
                title: "AI Permit Intelligence Report",
                query: input.governedInput.query,
                generatedAt: new Date().toISOString(),
                assistantAnswer,
                summary,
                matchingPermits: trustedContext.matchingPermits,
                sources: trustedContext.matchingPermits.map((permit) => permit.id).filter(Boolean),
                assumptions: [
                    "The answer is limited to permit records available in the backend.",
                    "Permit evidence was filtered before LLM generation.",
                    ...inferredConstraints,
                ],
                queryPlan: {
                    strategy: "sql-first-evidence-bound-answering",
                    planner: "permit-domain-router",
                    domain: "permits",
                    filtersApplied: filters,
                    inferredConstraints,
                },
                trustedContext,
            },
            metadata: {
                feature: "ai-query",
                domain: "permits",
                confidence: trustedContext.matchingPermits.length > 0 ? 0.87 : 0.65,
                confidenceLevel: trustedContext.matchingPermits.length > 0 ? "high" : "medium",
                modelVersion: this.deps.model,
                processingTimeMs: Date.now() - input.startedAt,
                sources: trustedContext.matchingPermits.map((permit) => permit.id).filter(Boolean),
                warnings: [
                    "Permit answers are based on backend permit records and filtered permit status logic.",
                ],
                guardrails: {
                    permissionAware: true,
                    role: input.role,
                    requireCitations: requireCitations(input.settings),
                    ragSources: input.settings.ragSources,
                    exportsAllowed: Boolean(input.settings.allowExports),
                    maxSourceRecords: input.governedInput.maxSourceRecords,
                },
                execution: {
                    mode: "sql-first",
                    domain: "permits",
                    primaryStore: "postgresql",
                    citedRecordCount: trustedContext.matchingPermits.length,
                },
            },
        };
        await this.deps.savePrediction("ai-query", input.governedInput, output, Number(output.metadata.confidence), input.user?.id);
        await this.deps.savePromptAudit({
            feature: "ai-query",
            prompt: input.prompt,
            output,
            confidence: Number(output.metadata.confidence),
            user: input.user,
        });
        return output;
    }
}
