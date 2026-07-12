import { LlmClient } from "./infra/llm.client.js";
import { RagEngine } from "./infra/rag.engine.js";
import { AiRepository } from "./ai.repository.js";
import { createHash } from "crypto";
import { ReportsService } from "../reports/reports.service.js";
import type { AiQueryInput } from "./ai.types.js";

type Json = Record<string, unknown>;
type AiActor = { id?: string; email?: string; role?: string; name?: string };
type AiGuardrailSettings = {
  enabled?: boolean;
  allowedRoles?: string[];
  requireCitations?: boolean;
  requireCitation?: boolean;
  allowExports?: boolean;
  maxSourceRecords?: number;
  ragSources?: string[];
};
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

export class AiService {
  private llm = new LlmClient();
  private rag = new RagEngine();
  private repository = new AiRepository();
  private reports = new ReportsService();
  private model = process.env.AI_MODEL || "local-fallback";

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
    const result = await this.reports.list({ all: true }, 1, 10000);
    const reports = applyAiFilters(result.data as ReportRow[], governedInput);
    const total = reports.length;
    const intent = detectIntent(governedInput.query);

    if (total === 0) {
      const report = {
        title: `AI SHEQ Data Intelligence Report - ${formatPeriod(governedInput.filters)}`,
        query: governedInput.query,
        generatedAt: new Date().toISOString(),
        period: formatPeriod(governedInput.filters),
        executiveSummary:
          "No matching live backend records were found for this question, so the AI did not generate KPI values or trends.",
        kpis: [
          {
            label: "Matching backend records",
            value: 0,
            note: "No live data found",
          },
        ],
        interpretation: [
          "The assistant only answers from authenticated backend records.",
          "No report IDs matched the selected question and filters.",
          "Adjust the time period, location, department, severity, status or category, then run the question again.",
        ],
        dataExplanations: [
          "No matching live backend records were found.",
          "No mock data was used.",
          "No frontend-only fallback data was used.",
          "The assistant cannot calculate KPIs, trends, charts or management actions without matching source records.",
        ],
        trends: [],
        tables: [
          {
            title: "Data Availability",
            headers: ["Check", "Result"],
            rows: [["Live backend records", "0 matching records"]],
          },
        ],
        recommendedActions: [
          "Confirm the backend is connected to the local database or PostgreSQL.",
          "Confirm Google Sheets sync has imported the latest reports.",
          "Review filters and retry with a wider period if needed.",
        ],
        managementActions: [
          "Do not use this response for management decisions until live source records are available.",
          "Confirm the database and Google Sheets sync status, then regenerate the report.",
        ],
        sources: [],
        citations: {
          dataset: [],
          kpis: {},
          tables: {},
          managementActions: [],
        },
        assumptions: [
          "No mock data was used.",
          "No frontend-only fallback data was used.",
          "The answer is limited to live backend records available to the authenticated user.",
          "Permission-aware AI guardrails were applied.",
        ],
      };

      const output = {
        success: true,
        data: {
          ...report,
          export:
            governedInput.exportFormat === "html"
              ? { format: "html", content: buildHtmlExport(report) }
              : undefined,
        },
        metadata: {
          feature: "ai-query",
          confidence: 1,
          confidenceLevel: "high",
          modelVersion: this.model,
          processingTimeMs: Date.now() - startedAt,
          sources: [],
          warnings: report.assumptions,
          guardrails: {
            permissionAware: true,
            role,
            requireCitations: requireCitations(settings),
            ragSources: settings.ragSources,
            exportsAllowed: Boolean(settings.allowExports),
          },
        },
      };

      await this.savePredictionBestEffort(
        "ai-query",
        governedInput,
        output,
        1,
        user?.id,
      );
      await this.savePromptAuditBestEffort({
        feature: "ai-query",
        prompt,
        output,
        confidence: 1,
        user,
      });
      return output;
    }

    const unsafeActs = reports.filter(
      (report) => report.type === "Unsafe Act",
    ).length;
    const unsafeConditions = reports.filter(
      (report) => report.type === "Unsafe Condition",
    ).length;
    const open = reports.filter((report) => report.status === "Open").length;
    const closed = reports.filter(
      (report) => report.status === "Closed",
    ).length;
    const pending = reports.filter(isPending).length;
    const overdue = reports.filter(isOverdue).length;
    const recurring = reports.filter((report) =>
      isRecurringCandidate(report, reports),
    ).length;
    const recordable = reports.filter(isRecordable).length;
    const lti = reports.filter(isLikelyLti).length;
    const nearMiss = reports.filter((report) => report.isNearMiss).length;
    const topLocations = countBy(
      reports.map((report) => report.location),
    ).slice(0, 5);
    const topCategories = countBy(
      reports.map((report) => report.category),
    ).slice(0, 5);
    const severityCounts = countBy(reports.map((report) => report.severity));
    const statusCounts = countBy(
      reports.map((report) => (isOverdue(report) ? "Overdue" : report.status)),
    );
    const departmentCounts = countBy(
      reports.map((report) => report.department || "Unspecified"),
    ).slice(0, 10);
    const months = new Map<string, ReportRow[]>();

    for (const report of reports) {
      const date = reportDate(report);
      if (!date) continue;
      const key = monthKey(date);
      months.set(key, [...(months.get(key) ?? []), report]);
    }

    const trends = [...months.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, rows]) => {
        const locations = countBy(rows.map((report) => report.location)).map(
          ([location, count]) => ({
            location,
            count,
            score: locationScore(rows, location),
          }),
        );
        const ranked = locations.sort(
          (left, right) => left.score - right.score || right.count - left.count,
        );
        const lowest = ranked[0];
        const highest = ranked[ranked.length - 1];
        return {
          month,
          unsafeActs: rows.filter((report) => report.type === "Unsafe Act")
            .length,
          unsafeConditions: rows.filter(
            (report) => report.type === "Unsafe Condition",
          ).length,
          total: rows.length,
          highestRatedLocation: highest?.location,
          highestRatedScore: highest?.score,
          lowestRatedLocation: lowest?.location,
          lowestRatedScore: lowest?.score,
        };
      });

    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    const direction =
      latest && previous
        ? latest.total > previous.total
          ? "increasing"
          : latest.total < previous.total
            ? "decreasing"
            : "stable"
        : "stable";
    const peak = [...trends].sort((left, right) => right.total - left.total)[0];
    const closureRate = total ? Math.round((closed / total) * 100) : 0;
    const severityTable = {
      title: "Incidents By Severity",
      headers: ["Severity", "Reports", "Share"],
      rows: severityCounts.map(([severity, count]) => [
        severity,
        count,
        percentage(count, total),
      ]),
    };
    const statusTable = {
      title: "Actions By Status",
      headers: ["Status", "Reports", "Share"],
      rows: [
        ["Open", open, percentage(open, total)],
        ["Pending / In Progress", pending, percentage(pending, total)],
        ["Recurring risk candidates", recurring, percentage(recurring, total)],
        ["Closed", closed, percentage(closed, total)],
        ["Overdue", overdue, percentage(overdue, total)],
        ...statusCounts
          .filter(
            ([status]) =>
              !["open", "closed", "overdue"].includes(status.toLowerCase()),
          )
          .map(([status, count]) => [status, count, percentage(count, total)]),
      ],
    };
    const locationTable = {
      title: "Location Hotspots And Rated Locations",
      headers: ["Location", "Reports", "Rating", "Critical", "Open", "Overdue"],
      rows: topLocations.map(([location, count]) => {
        const scoped = reports.filter((report) => report.location === location);
        return [
          location,
          count,
          `${locationScore(reports, location)}%`,
          scoped.filter((report) => report.severity === "Critical").length,
          scoped.filter((report) => isStatus(report, "Open")).length,
          scoped.filter(isOverdue).length,
        ];
      }),
    };
    const departmentTable = {
      title: "Department Exposure",
      headers: ["Department", "Reports", "Share"],
      rows: departmentCounts.map(([department, count]) => [
        department,
        count,
        percentage(count, total),
      ]),
    };
    const recordableTable = {
      title: "Recordable / LTI Screening",
      headers: ["Screen", "Count", "Important note"],
      rows: [
        [
          "Potential recordable incidents",
          recordable,
          "Screened from severity and injury/illness wording; validate before statutory reporting.",
        ],
        [
          "Possible LTI cases",
          lti,
          "Screened from criticality and lost-time/medical-treatment wording.",
        ],
        [
          "Near misses",
          nearMiss,
          "Leading indicator for proactive intervention.",
        ],
      ],
    };
    const categoryTable = {
      title: "Top Hazard Categories",
      headers: ["Category", "Reports", "Share"],
      rows: topCategories.map(([category, count]) => [
        category,
        count,
        percentage(count, total),
      ]),
    };
    const sourceRecords = sourceIds(
      reports,
      undefined,
      governedInput.maxSourceRecords,
    );
    const kpiCitations = {
      totalReports: sourceIds(reports),
      unsafeActs: sourceIds(reports, (report) => report.type === "Unsafe Act"),
      unsafeConditions: sourceIds(
        reports,
        (report) => report.type === "Unsafe Condition",
      ),
      openActions: sourceIds(reports, (report) => isStatus(report, "Open")),
      overdueActions: sourceIds(reports, isOverdue),
      closedActions: sourceIds(reports, (report) => isStatus(report, "Closed")),
      recordableScreen: sourceIds(reports, isRecordable),
      possibleLti: sourceIds(reports, isLikelyLti),
      nearMisses: sourceIds(reports, (report) => Boolean(report.isNearMiss)),
    };
    const trendExplanation =
      latest && previous
        ? `${latest.month} changed from ${previous.total} to ${latest.total} reports compared with ${previous.month}, so the selected trend is ${direction}.`
        : "There is not enough monthly history in the filtered live data to calculate a reliable month-on-month direction.";

    const managementActions = [
      overdue > 0
        ? `Escalate ${overdue} overdue action${overdue === 1 ? "" : "s"} today, assign named owners, and require closure evidence.`
        : "Maintain closure discipline; no overdue actions were detected in the selected dataset.",
      open > 0
        ? `Review ${open} open report${open === 1 ? "" : "s"} by severity and due date during the next SHEQ meeting.`
        : "Keep current closure controls in place; no open reports were detected.",
      recurring > 0
        ? `Launch a recurring-risk review for ${recurring} report${recurring === 1 ? "" : "s"} sharing repeated location/category patterns.`
        : "No repeated location/category pattern reached the recurring-risk threshold in this dataset.",
      topLocations[0]
        ? `Run a focused site walk at ${topLocations[0][0]}, which contributes ${topLocations[0][1]} report${topLocations[0][1] === 1 ? "" : "s"}.`
        : "No location hotspot was available from the selected records.",
      recordable > 0 || lti > 0
        ? "Validate recordable and LTI screening results with EHS before management or statutory publication."
        : "Continue monitoring recordable and LTI screens; no likely cases were detected from current wording.",
    ];

    const dataExplanations = [
      `The assistant analyzed ${total} live backend report${total === 1 ? "" : "s"} for ${formatPeriod(governedInput.filters)}. No mock or frontend fallback data was used.`,
      `The dataset contains ${unsafeActs} unsafe act${unsafeActs === 1 ? "" : "s"} and ${unsafeConditions} unsafe condition${unsafeConditions === 1 ? "" : "s"}.`,
      `Closure performance is ${closureRate}% based on ${closed} closed report${closed === 1 ? "" : "s"} out of ${total}.`,
      trendExplanation,
      topLocations[0]
        ? `${topLocations[0][0]} is the leading hotspot by report count.`
        : "No location hotspot could be calculated.",
      topCategories[0]
        ? `${topCategories[0][0]} is the most frequent hazard category.`
        : "No category hotspot could be calculated.",
      requireCitations(settings)
        ? `Every numeric finding is backed by source report IDs. ${sourceNote(sourceRecords)}.`
        : "Source citations are optional under current admin guardrail settings.",
    ];

    const selectedTables = [
      ...(intent.wantsTrend || intent.wantsExecutiveReport
        ? [
            {
              title: "Monthly Unsafe Acts / Conditions and Rated Locations",
              headers: [
                "Month",
                "Unsafe Acts",
                "Unsafe Conditions",
                "Total",
                "Highest Rated",
                "Lowest Rated",
              ],
              rows: trends.map((row) => [
                row.month,
                row.unsafeActs,
                row.unsafeConditions,
                row.total,
                `${row.highestRatedLocation ?? "none"} (${row.highestRatedScore ?? 0}%)`,
                `${row.lowestRatedLocation ?? "none"} (${row.lowestRatedScore ?? 0}%)`,
              ]),
            },
          ]
        : []),
      ...(intent.wantsKpis || intent.wantsStatus || intent.wantsExecutiveReport
        ? [statusTable]
        : []),
      ...(intent.wantsLocations || intent.wantsExecutiveReport
        ? [locationTable, departmentTable]
        : []),
      ...(intent.wantsSeverity || intent.wantsExecutiveReport
        ? [severityTable]
        : []),
      ...(intent.wantsRecordable || intent.wantsNearMiss || intent.wantsKpis
        ? [recordableTable]
        : []),
      categoryTable,
    ];
    const tableCitations = Object.fromEntries(
      selectedTables.map((table) => {
        if (table.title.includes("Monthly"))
          return [table.title, sourceRecords];
        if (table.title.includes("Status"))
          return [
            table.title,
            sourceIds(reports, (report) => report.status !== ""),
          ];
        if (table.title.includes("Location"))
          return [
            table.title,
            sourceIds(reports, (report) =>
              topLocations.some(([location]) => location === report.location),
            ),
          ];
        if (table.title.includes("Department"))
          return [
            table.title,
            sourceIds(reports, (report) =>
              departmentCounts.some(
                ([department]) =>
                  department === (report.department || "Unspecified"),
              ),
            ),
          ];
        if (table.title.includes("Severity"))
          return [table.title, sourceRecords];
        if (table.title.includes("Recordable"))
          return [
            table.title,
            sourceIds(
              reports,
              (report) =>
                isRecordable(report) ||
                isLikelyLti(report) ||
                Boolean(report.isNearMiss),
            ),
          ];
        return [table.title, sourceRecords];
      }),
    );
    const actionCitations = managementActions.map((action, index) => ({
      action,
      sources:
        index === 0
          ? sourceIds(reports, isOverdue)
          : index === 1
            ? sourceIds(reports, (report) => !isStatus(report, "Closed"))
            : index === 2
              ? sourceIds(reports, (report) =>
                  isRecurringCandidate(report, reports),
                )
              : index === 3 && topLocations[0]
                ? sourceIds(
                    reports,
                    (report) => report.location === topLocations[0]?.[0],
                  )
                : sourceIds(
                    reports,
                    (report) => isRecordable(report) || isLikelyLti(report),
                  ),
    }));
    const dataQualityWarnings = [
      "Recordable and LTI values are screening indicators and must be validated by EHS.",
      "Location ratings are calculated from critical reports, open actions and overdue actions in each month.",
      "The answer uses backend records available to the authenticated user at generation time.",
      "Permission-aware AI guardrails were applied.",
      reports.length > sourceRecords.length
        ? `Source list is capped at ${sourceRecords.length} report IDs by the maxSourceRecords guardrail.`
        : "",
      trends.length < 3
        ? "Monthly trend confidence is reduced because fewer than three months of matching data were available."
        : "",
      requireCitations(settings)
        ? "Every answer includes backend source report IDs where records are available."
        : "Source citations are optional under current admin policy.",
    ].filter(Boolean);
    const confidence = confidenceFromData(total, trends.length);

    const report = {
      title: `AI SHEQ Data Intelligence Report - ${formatPeriod(governedInput.filters)}`,
      query: governedInput.query,
      generatedAt: new Date().toISOString(),
      period: formatPeriod(governedInput.filters),
      executiveSummary:
        intent.wantsExecutiveReport || intent.wantsTrend || intent.wantsKpis
          ? `The selected live dataset contains ${total} reports for ${formatPeriod(governedInput.filters)}. The monthly trend is ${direction}, with ${unsafeActs} unsafe acts, ${unsafeConditions} unsafe conditions, ${open} open actions, ${pending} pending/in-progress actions, ${recurring} recurring-risk candidates, and ${overdue} overdue actions.`
          : `Based on live backend records, ${total} reports matched your question. The strongest signals are ${topLocations[0]?.[0] ?? "no clear location hotspot"}, ${topCategories[0]?.[0] ?? "no clear hazard category"}, ${open} open actions, and ${overdue} overdue actions.`,
      kpis: [
        {
          label: "Total reports",
          value: total,
          note: "Filtered backend records",
        },
        {
          label: "Unsafe acts",
          value: unsafeActs,
          note: "Behaviour/procedure deviations",
        },
        {
          label: "Unsafe conditions",
          value: unsafeConditions,
          note: "Physical workplace defects",
        },
        { label: "Open actions", value: open, note: "Awaiting closure" },
        {
          label: "Overdue actions",
          value: overdue,
          note: "Escalation candidates",
        },
        {
          label: "Closure rate",
          value: `${closureRate}%`,
          note: "Closed / total",
        },
        {
          label: "Recordable screen",
          value: recordable,
          note: "Requires EHS validation",
        },
        { label: "Possible LTI", value: lti, note: "Screening only" },
        { label: "Near misses", value: nearMiss, note: "Leading indicator" },
      ],
      interpretation: [
        ...dataExplanations,
        unsafeConditions > unsafeActs
          ? "Unsafe conditions are higher than unsafe acts, so engineering controls, inspections, maintenance and housekeeping should receive priority."
          : unsafeActs > unsafeConditions
            ? "Unsafe acts are higher than unsafe conditions, so supervision, coaching, task planning and procedural discipline should receive priority."
            : "Unsafe acts and unsafe conditions are balanced, so behavioural controls and workplace-condition controls need equal management attention.",
        latest && previous
          ? `${latest.month} changed from ${previous.total} to ${latest.total} reports compared with ${previous.month}.`
          : "There is not enough monthly history in the filtered data to calculate movement.",
        peak
          ? `${peak.month} is the peak month with ${peak.total} reports. Highest rated: ${peak.highestRatedLocation ?? "none"} (${peak.highestRatedScore ?? 0}%). Lowest rated: ${peak.lowestRatedLocation ?? "none"} (${peak.lowestRatedScore ?? 0}%).`
          : "No peak month can be calculated from the filtered data.",
        topLocations.length
          ? `Top reporting locations are ${topLocations.map(([location, count]) => `${location} (${count})`).join(", ")}.`
          : "No location hotspot is visible from the filtered data.",
        topCategories.length
          ? `Top hazard categories are ${topCategories.map(([category, count]) => `${category} (${count})`).join(", ")}.`
          : "No category concentration is visible from the filtered data.",
      ],
      dataExplanations,
      trends,
      tables: selectedTables,
      citations: {
        dataset: sourceRecords,
        kpis: kpiCitations,
        tables: tableCitations,
        managementActions: actionCitations,
      },
      managementActions,
      recommendedActions: managementActions,
      sources: sourceRecords,
      assumptions: dataQualityWarnings,
    };

    const output = {
      success: true,
      data: {
        ...report,
        export:
          governedInput.exportFormat === "html"
            ? { format: "html", content: buildHtmlExport(report) }
            : undefined,
      },
      metadata: {
        feature: "ai-query",
        confidence: confidence.score,
        confidenceLevel: confidence.level,
        modelVersion: this.model,
        processingTimeMs: Date.now() - startedAt,
        sources: report.sources,
        warnings: report.assumptions,
        guardrails: {
          permissionAware: true,
          role,
          requireCitations: requireCitations(settings),
          ragSources: settings.ragSources,
          exportsAllowed: Boolean(settings.allowExports),
          maxSourceRecords: governedInput.maxSourceRecords,
        },
      },
    };

    await this.savePredictionBestEffort(
      "ai-query",
      governedInput,
      output,
      confidence.score,
      user?.id,
    );
    await this.savePromptAuditBestEffort({
      feature: "ai-query",
      prompt,
      output,
      confidence: confidence.score,
      user,
    });
    return output;
  }

  async investigationAssistant(data: any, userId?: string): Promise<Json> {
    const user = `Incident: ${JSON.stringify(data)}`;
    return this.generate(
      "investigation-assistant",
      "You are an expert HSE incident investigation assistant. Provide structured root cause questions and corrective action guidance.",
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
      "You are a safety assistant chatbot for Crown Paints HSE. Use the provided knowledge when relevant.",
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
      "Recommend HSE training modules based on the provided profile.",
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
      "Forecast HSE KPI values from the provided series.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  async executiveReports(data: any, userId?: string): Promise<Json> {
    return this.generate(
      "executive-reports",
      "Produce a concise executive HSE report from the supplied data.",
      `Input: ${JSON.stringify(data)}`,
      userId,
    );
  }

  getRepository(): AiRepository {
    return this.repository;
  }
}
