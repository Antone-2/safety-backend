import { LlmClient } from "./infra/llm.client.js";
import { RagEngine } from "./infra/rag.engine.js";
import {
  detectAiQueryDomain,
  OperationalQueryEngine,
} from "./infra/operational-query.engine.js";
import { ReportQueryEngine } from "./infra/report-query.engine.js";
import type {
  AiActor,
  AiGuardrailSettings,
} from "./infra/query-domain.contract.js";
import { AiRepository } from "./ai.repository.js";
import { createHash } from "crypto";
import { ReportsService } from "../reports/reports.service.js";
import type { AiQueryInput } from "./ai.types.js";
import type { ReportFilters } from "../reports/reports.service.js";

type Json = Record<string, unknown>;
type ReportRow = {
  id: string;
  date: string;
  location: string;
  reporter?: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: string;
  category: string;
  type: "Unsafe Act" | "Unsafe Condition";
  resolutionDays?: number;
  slaHours?: number;
  dueAt?: string;
  isNearMiss?: boolean;
  department?: string;
  shift?: string;
};

type AiQueryIntent = {
  wantsTrend: boolean;
  wantsKpis: boolean;
  wantsLocations: boolean;
  wantsSeverity: boolean;
  wantsStatus: boolean;
  wantsNearMiss: boolean;
  wantsRecordable: boolean;
  wantsActions: boolean;
  wantsExecutiveReport: boolean;
};

type SummarySnapshot = {
  total?: number;
  open?: number;
  closed?: number;
  overdue?: number;
  criticalOpen?: number;
  avgResolution?: number;
  recordableIncidents?: number;
  lostTimeInjuries?: number;
  medicalTreatmentCases?: number;
  nearMissCount?: number;
  daysSinceLastLti?: number;
  totalManhoursWorked?: number;
  totalWorkforce?: number;
  severityCounts?: Record<string, number>;
};

type PlannedAiQuery = {
  reportFilters: ReportFilters;
  responseFilters: NonNullable<AiQueryInput["filters"]>;
  inferredConstraints: string[];
};

function buildResponse(
  feature: string,
  content: string,
  modelVersion: string,
  confidence = 0.7,
): Json {
  return {
    feature,
    model: modelVersion,
    confidence,
    generatedAt: new Date().toISOString(),
    content,
  };
}

function reportDate(report: ReportRow) {
  const date = new Date(report.date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(report: ReportRow) {
  return (
    report.status !== "Closed" &&
    Boolean(report.dueAt) &&
    new Date(report.dueAt as string) < new Date()
  );
}

function isLikelyLti(report: ReportRow) {
  const text =
    `${report.description} ${report.category} ${report.type}`.toLowerCase();
  return (
    report.severity === "Critical" ||
    text.includes("lost time") ||
    text.includes("lti") ||
    text.includes("hospital") ||
    text.includes("fracture") ||
    text.includes("medical treatment") ||
    text.includes("time off work")
  );
}

function isRecordable(report: ReportRow) {
  const text =
    `${report.description} ${report.category} ${report.type}`.toLowerCase();
  return (
    isLikelyLti(report) ||
    report.severity === "High" ||
    text.includes("injury") ||
    text.includes("illness") ||
    text.includes("burn") ||
    text.includes("cut") ||
    text.includes("chemical exposure")
  );
}

function countBy<T extends string>(rows: T[]) {
  const counts = new Map<T, number>();
  for (const row of rows.filter(Boolean))
    counts.set(row, (counts.get(row) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function detectIntent(query: string): AiQueryIntent {
  const text = query.toLowerCase();
  return {
    wantsTrend:
      /trend|monthly|month|graph|chart|ytd|year to date|movement|pattern/.test(
        text,
      ),
    wantsKpis:
      /kpi|rate|trir|ltifr|ltisr|manhour|man hour|workforce|scorecard|indicator/.test(
        text,
      ),
    wantsLocations:
      /location|site|department|area|hotspot|top rated|lowest rated|highest rated/.test(
        text,
      ),
    wantsSeverity: /severity|critical|high|medium|low|serious/.test(text),
    wantsStatus:
      /status|open|closed|pending|overdue|recurring|in progress|closure/.test(
        text,
      ),
    wantsNearMiss: /near miss|near-miss|leading indicator/.test(text),
    wantsRecordable:
      /recordable|trir|lti|ltifr|lost time|medical treatment/.test(text),
    wantsActions:
      /action|recommend|management|what should|next step|capa|corrective/.test(
        text,
      ),
    wantsExecutiveReport:
      /report|executive|management review|board|summary|pack/.test(text),
  };
}

function isStatus(report: ReportRow, status: string) {
  return report.status.toLowerCase() === status.toLowerCase();
}

function isPending(report: ReportRow) {
  return /pending|in progress|assigned|review/i.test(report.status);
}

function isRecurringCandidate(report: ReportRow, allReports: ReportRow[]) {
  const sameRisk = allReports.filter(
    (item) =>
      item.id !== report.id &&
      item.location === report.location &&
      item.category === report.category,
  );
  return sameRisk.length >= 2;
}

function percentage(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

function requireCitations(settings: AiGuardrailSettings) {
  return Boolean(settings.requireCitations ?? settings.requireCitation ?? true);
}

function sourceIds(
  reports: ReportRow[],
  predicate?: (report: ReportRow) => boolean,
  limit = 12,
) {
  const scoped = predicate ? reports.filter(predicate) : reports;
  return [...new Set(scoped.map((report) => report.id).filter(Boolean))].slice(
    0,
    limit,
  );
}

function sourceNote(ids: string[]) {
  return ids.length ? `Sources: ${ids.join(", ")}` : "Sources: none";
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function confidenceFromData(total: number, trendMonths: number) {
  if (total >= 25 && trendMonths >= 6)
    return { score: 0.9, level: "very-high" as const };
  if (total >= 10 && trendMonths >= 3)
    return { score: 0.84, level: "high" as const };
  if (total >= 3) return { score: 0.72, level: "medium" as const };
  return { score: 0.58, level: "low" as const };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function locationScore(reports: ReportRow[], location: string) {
  const scoped = reports.filter((report) => report.location === location);
  const total = Math.max(1, scoped.length);
  const critical = scoped.filter(
    (report) => report.severity === "Critical",
  ).length;
  const open = scoped.filter((report) => report.status === "Open").length;
  const overdue = scoped.filter(isOverdue).length;
  const raw =
    100 -
    (critical / total) * 120 -
    (open / total) * 40 -
    (overdue / total) * 60;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function formatPeriod(filters?: AiQueryInput["filters"]) {
  if (filters?.dateFrom || filters?.dateTo) {
    return `${filters.dateFrom ?? "start"} to ${filters.dateTo ?? "today"}`;
  }
  return `${new Date().getFullYear()} YTD`;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function daysAgo(value: Date, days: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function planAiQuery(input: AiQueryInput, _intent: AiQueryIntent): PlannedAiQuery {
  const now = new Date();
  const text = input.query.toLowerCase();
  const responseFilters: NonNullable<AiQueryInput["filters"]> = {
    dateFrom: input.filters?.dateFrom,
    dateTo: input.filters?.dateTo,
    location: input.filters?.location,
    department: input.filters?.department,
    severity: input.filters?.severity,
    status: input.filters?.status,
    category: input.filters?.category,
  };
  const inferredConstraints: string[] = [];

  if (!responseFilters.dateFrom && !responseFilters.dateTo) {
    if (/\btoday\b/.test(text)) {
      responseFilters.dateFrom = isoDate(now);
      responseFilters.dateTo = isoDate(now);
      inferredConstraints.push("Applied 'today' date window from the user question.");
    } else if (/this week|weekly|last 7 days/.test(text)) {
      responseFilters.dateFrom = isoDate(daysAgo(now, 6));
      responseFilters.dateTo = isoDate(now);
      inferredConstraints.push("Applied a 7-day reporting window from the user question.");
    } else if (/this month|month to date|mtd/.test(text)) {
      responseFilters.dateFrom = isoDate(startOfMonth(now));
      responseFilters.dateTo = isoDate(now);
      inferredConstraints.push("Applied month-to-date filtering from the user question.");
    } else {
      responseFilters.dateFrom = isoDate(startOfYear(now));
      responseFilters.dateTo = isoDate(now);
      inferredConstraints.push("Applied year-to-date filtering by default.");
    }
  }

  if (!responseFilters.status) {
    if (/\bopen\b/.test(text)) {
      responseFilters.status = "Open";
      inferredConstraints.push("Filtered to open records from the user question.");
    } else if (/\bclosed\b/.test(text)) {
      responseFilters.status = "Closed";
      inferredConstraints.push("Filtered to closed records from the user question.");
    }
  }

  if (!responseFilters.severity) {
    if (/\bcritical\b/.test(text)) {
      responseFilters.severity = "Critical";
      inferredConstraints.push("Filtered to critical severity from the user question.");
    } else if (/\bhigh\b/.test(text)) {
      responseFilters.severity = "High";
      inferredConstraints.push("Filtered to high severity from the user question.");
    } else if (/\bmedium\b/.test(text)) {
      responseFilters.severity = "Medium";
      inferredConstraints.push("Filtered to medium severity from the user question.");
    } else if (/\blow\b/.test(text)) {
      responseFilters.severity = "Low";
      inferredConstraints.push("Filtered to low severity from the user question.");
    }
  }

  const reportFilters: ReportFilters = {
    all: true,
    dateFrom: responseFilters.dateFrom,
    dateTo: responseFilters.dateTo,
    location: responseFilters.location,
    severity: responseFilters.severity,
    status: responseFilters.status,
    category: responseFilters.category,
  };

  return { reportFilters, responseFilters, inferredConstraints };
}

function applyAiFilters(reports: ReportRow[], input: AiQueryInput) {
  const query = input.query.toLowerCase();
  const year = new Date().getFullYear();
  const inferredYtd =
    query.includes("ytd") ||
    query.includes("year to date") ||
    !input.filters?.dateFrom;
  const from = input.filters?.dateFrom
    ? new Date(input.filters.dateFrom)
    : inferredYtd
      ? new Date(year, 0, 1)
      : undefined;
  const to = input.filters?.dateTo
    ? new Date(input.filters.dateTo)
    : new Date();

  return reports.filter((report) => {
    const date = reportDate(report);
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (input.filters?.location && report.location !== input.filters.location)
      return false;
    if (
      input.filters?.department &&
      report.department !== input.filters.department
    )
      return false;
    if (input.filters?.severity && report.severity !== input.filters.severity)
      return false;
    if (input.filters?.status && report.status !== input.filters.status)
      return false;
    if (input.filters?.category && report.category !== input.filters.category)
      return false;
    return true;
  });
}

function buildHtmlExport(report: any) {
  const rows = report.trends
    .map(
      (row: any) =>
        `<tr><td>${escapeHtml(row.month)}</td><td>${escapeHtml(row.unsafeActs)}</td><td>${escapeHtml(row.unsafeConditions)}</td><td>${escapeHtml(row.total)}</td><td>${escapeHtml(row.highestRatedLocation ?? "")} ${escapeHtml(row.highestRatedScore ?? "")}</td><td>${escapeHtml(row.lowestRatedLocation ?? "")} ${escapeHtml(row.lowestRatedScore ?? "")}</td></tr>`,
    )
    .join("");
  const kpis = report.kpis
    .map(
      (kpi: any) =>
        `<div class="kpi"><strong>${escapeHtml(kpi.value)}</strong><br>${escapeHtml(kpi.label)}<br><small>${escapeHtml(kpi.note ?? "")}</small></div>`,
    )
    .join("");
  const tables = (report.tables ?? [])
    .map(
      (table: any) =>
        `<h2>${escapeHtml(table.title)}</h2><table><thead><tr>${table.headers.map((header: string) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row: unknown[]) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    )
    .join("");
  const warnings = (report.assumptions ?? [])
    .map((warning: string) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033}h1,h2{color:#082d63}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid #d0d5dd;border-radius:8px;padding:10px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #d0d5dd;padding:8px;text-align:left}th{background:#f2f4f7}</style></head><body><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.executiveSummary)}</p><div class="kpis">${kpis}</div><h2>Trend Explanation</h2>${report.interpretation.map((line: string) => `<p>${escapeHtml(line)}</p>`).join("")}<h2>Monthly Trend Data</h2><table><thead><tr><th>Month</th><th>Unsafe Acts</th><th>Unsafe Conditions</th><th>Total</th><th>Highest Rated</th><th>Lowest Rated</th></tr></thead><tbody>${rows}</tbody></table>${tables}<h2>Recommended Actions</h2><ol>${report.recommendedActions.map((action: string) => `<li>${escapeHtml(action)}</li>`).join("")}</ol><h2>Warnings And Assumptions</h2><ul>${warnings}</ul><h2>Sources</h2><p>${escapeHtml(report.sources.join(", "))}</p></body></html>`;
}

function compactReportEvidence(report: ReportRow) {
  return {
    id: report.id,
    date: report.date,
    location: report.location,
    department: report.department || "Unspecified",
    severity: report.severity,
    status: report.status,
    category: report.category,
    type: report.type,
    dueAt: report.dueAt,
    isNearMiss: Boolean(report.isNearMiss),
    description: report.description.slice(0, 240),
  };
}

export class AiService {
  private llm = new LlmClient();
  private rag = new RagEngine();
  private repository = new AiRepository();
  private reports = new ReportsService();
  private model = process.env.AI_MODEL || "local-fallback";
  private operationalQueryEngine = new OperationalQueryEngine({
    llm: this.llm,
    model: this.model,
    savePrediction: (feature, input, output, confidence, userId) =>
      this.savePredictionBestEffort(feature, input, output, confidence, userId),
    savePromptAudit: (input) => this.savePromptAuditBestEffort(input),
  });
  private reportQueryEngine = new ReportQueryEngine({
    llm: this.llm,
    model: this.model,
    savePrediction: (feature, input, output, confidence, userId) =>
      this.savePredictionBestEffort(feature, input, output, confidence, userId),
    savePromptAudit: (input) => this.savePromptAuditBestEffort(input),
  });

  private async generateEvidenceBoundAnswer(input: {
    question: string;
    role: string;
    period: string;
    filters?: AiQueryInput["filters"];
    intent: AiQueryIntent;
    summary: SummarySnapshot;
    topLocations: Array<[string, number]>;
    topCategories: Array<[string, number]>;
    topReporters: Array<{ reporter: string; reportCount: number }>;
    trends: Array<Record<string, unknown>>;
    managementActions: string[];
    citedReports: ReportRow[];
  }) {
    const trustedContext = {
      question: input.question,
      actorRole: input.role,
      period: input.period,
      filters: input.filters || {},
      intent: input.intent,
      summary: input.summary,
      topLocations: input.topLocations.map(([location, count]) => ({
        location,
        count,
      })),
      topCategories: input.topCategories.map(([category, count]) => ({
        category,
        count,
      })),
      topReportersMonthToDate: input.topReporters,
      monthlyTrends: input.trends.slice(-12),
      recommendedActions: input.managementActions,
      citedReports: input.citedReports.map(compactReportEvidence),
    };

    const answer = await this.llm.generate(
      [
        "You are Crown Safety Data AI.",
        "Answer only from the trusted analytics context you are given.",
        "Do not invent KPIs, counts, dates, locations, departments, or incidents.",
        "If the context is insufficient, say exactly what is missing.",
        "Use a concise executive tone.",
        "Cite report IDs inline when making factual claims.",
      ].join(" "),
      [
        `User question: ${input.question}`,
        `Period: ${input.period}`,
        `Trusted analytics context JSON: ${JSON.stringify(trustedContext)}`,
        "Return a short answer with:",
        "1. direct answer",
        "2. supporting evidence",
        "3. immediate actions if relevant",
      ].join("\n\n"),
      { temperature: 0.1, maxTokens: 900 },
    );

    return { answer, trustedContext };
  }

  private async generate(
    feature: string,
    system: string,
    user: string,
    userId?: string,
  ): Promise<Json> {
    const text = await this.llm.generate(system, user, {
      temperature: 0.2,
      maxTokens: 1200,
    });
    const output = buildResponse(feature, text, this.model);
    await this.savePredictionBestEffort(feature, user, output, 0.7, userId);
    return output;
  }

  private async savePredictionBestEffort(
    feature: string,
    input: unknown,
    output: unknown,
    confidence: number,
    userId?: string,
  ) {
    try {
      const inputHash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      await this.repository.savePrediction(
        feature,
        inputHash,
        output,
        this.model,
        confidence,
        userId,
      );
    } catch (error) {
      console.warn(
        "AI prediction audit skipped:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async savePromptAuditBestEffort(input: {
    feature: string;
    prompt: string;
    output: any;
    confidence: number;
    user?: AiActor;
    denied?: boolean;
    denialReason?: string;
  }) {
    try {
      await this.repository.savePromptAudit({
        userId: input.user?.id,
        userEmail: input.user?.email,
        userRole: input.user?.role,
        feature: input.feature,
        prompt: input.prompt,
        responseSummary:
          input.output?.data?.executiveSummary ||
          input.output?.content ||
          input.output?.data?.title ||
          undefined,
        modelVersion: this.model,
        confidence: input.confidence,
        sources:
          input.output?.metadata?.sources || input.output?.data?.sources || [],
        warnings:
          input.output?.metadata?.warnings ||
          input.output?.data?.assumptions ||
          [],
        denied: input.denied,
        denialReason: input.denialReason,
      });
    } catch (error) {
      console.warn(
        "AI prompt audit skipped:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async query(data: AiQueryInput, user?: AiActor): Promise<Json> {
    const startedAt = Date.now();
    const settings =
      (await this.repository.getGuardrailSettings()) as AiGuardrailSettings;
    const role = user?.role || "unknown";
    const allowedRoles = Array.isArray(settings.allowedRoles)
      ? settings.allowedRoles
      : [];
    const prompt = JSON.stringify(data);
    const domain = detectAiQueryDomain(data.query);

    if (!settings.enabled || !allowedRoles.includes(role)) {
      const denialReason = !settings.enabled
        ? "AI assistant is disabled by admin policy."
        : "Your role is not allowed to use this AI feature.";
      const output = {
        success: false,
        error: "AI access denied",
        metadata: {
          feature: "ai-query",
          confidence: 1,
          confidenceLevel: "high",
          modelVersion: this.model,
          processingTimeMs: Date.now() - startedAt,
          sources: [],
          warnings: [denialReason],
          guardrails: {
            permissionAware: true,
            role,
            requireCitations: requireCitations(settings),
            ragSources: settings.ragSources,
          },
        },
      };
      await this.savePromptAuditBestEffort({
        feature: "ai-query",
        prompt,
        output,
        confidence: 1,
        user,
        denied: true,
        denialReason,
      });
      return output;
    }

    const governedInput = {
      ...data,
      exportFormat: settings.allowExports ? data.exportFormat : "json",
      maxSourceRecords: Math.min(
        data.maxSourceRecords,
        Number(settings.maxSourceRecords || 50),
      ),
    };
    if (domain === "training") {
      return this.operationalQueryEngine.executeDomainQuery("training", {
        governedInput,
        user,
        role,
        settings,
        startedAt,
        prompt,
      });
    }
    if (domain === "capa") {
      return this.operationalQueryEngine.executeDomainQuery("capa", {
        governedInput,
        user,
        role,
        settings,
        startedAt,
        prompt,
      });
    }
    if (domain === "permits") {
      return this.operationalQueryEngine.executeDomainQuery("permits", {
        governedInput,
        user,
        role,
        settings,
        startedAt,
        prompt,
      });
    }
    return this.reportQueryEngine.executeReportQuery({
      governedInput,
      user,
      role,
      settings,
      startedAt,
      prompt,
    });
  }

  async investigationAssistant(data: any, userId?: string): Promise<Json> {
    const user = `Incident: ${JSON.stringify(data)}`;
    return this.generate(
      "investigation-assistant",
      "You are an expert EHS incident investigation assistant. Provide structured root cause questions and corrective action guidance.",
      user,
      userId,
    );
  }

  async rootCauseAnalysis(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "root-cause-analysis",
      "You are a root cause analysis expert using ISO 45001 methodology.",
      `Context: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async hazardDetection(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "hazard-detection",
      "Identify safety hazards from the provided description and rate severity.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async riskPrediction(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "risk-prediction",
      "Predict risk scores for the given operational context.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async chatbot(data: any, userId?: string): Promise<Json> {
    const history = Array.isArray(data?.history) ? data.history : [];
    const message = data.message || data.query || "";
    const retrieved = await this.rag
      .search(message, { maxResults: 3 })
      .catch(() => []);
    const context = retrieved
      .map((r: any) => `- ${r.title}: ${r.excerpt}`)
      .join("\n");
    const reply = await this.llm.generate(
      "You are a safety assistant chatbot for Crown Paints EHS. Use the provided knowledge when relevant.",
      `Knowledge:\n${context}\n\nConversation: ${JSON.stringify(history)}\nUser: ${message}`,
      { temperature: 0.3 },
    );
    return buildResponse("chatbot", reply, this.model);
  }

  async complianceAssistant(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "compliance-assistant",
      "Map the provided process to ISO 45001 / regulatory compliance requirements and list gaps.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async trainingRecommendation(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "training-recommendation",
      "Recommend EHS training modules based on the provided profile.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async permitValidation(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "permit-validation",
      "Validate a permit-to-work application and flag missing safety controls.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async inspectionAssistant(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "inspection-assistant",
      "Generate a safety inspection checklist and findings from the input.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async safetyObservationAnalysis(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "safety-observation-analysis",
      "Analyze safety observations and suggest themes and actions.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async environmentalMonitoring(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "environmental-monitoring",
      "Summarize environmental monitoring data and compliance status.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async predictiveAnalytics(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "predictive-analytics",
      "Produce predictive analytics insights from the supplied metrics.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async dashboardInsights(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "dashboard-insights",
      "Summarize dashboard metrics into executive insights.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async documentSearch(data: any, userId?: string): Promise<Json> {
    const results = await this.rag
      .search(data.query, {
        category: data.category,
        maxResults: data.maxResults ?? 5,
      })
      .catch(() => []);
    return {
      feature: "document-search",
      results,
      generatedAt: new Date().toISOString(),
    };
  }

  async toolboxTalkGenerator(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "toolbox-talk-generator",
      "Generate a toolbox talk outline for the given topic.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async safetyAlertGenerator(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "safety-alert-generator",
      "Draft a safety alert message from the input.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async trendAnalysis(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "trend-analysis",
      "Analyze trends from historical incident data and surface patterns.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async correctiveActionRecommendation(
    data: any,
    userId?: string,
  ): Promise<Json> {
    return this.generate(
      "corrective-action-recommendation",
      "Recommend corrective and preventive actions for the described issue.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async kpiForecasting(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "kpi-forecasting",
      "Forecast EHS KPI values from the provided series.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async executiveReports(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "executive-reports",
      "Produce a concise executive EHS report from the supplied data.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  getRepository(): AiRepository {
    return this.repository;
  }
}
