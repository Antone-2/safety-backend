import { ReportsService } from "../../reports/reports.service.js";
function reportDate(report) {
    const date = new Date(report.date);
    return Number.isNaN(date.getTime()) ? null : date;
}
function isOverdue(report) {
    return (report.status !== "Closed" &&
        Boolean(report.dueAt) &&
        new Date(report.dueAt) < new Date());
}
function isLikelyLti(report) {
    const text = `${report.description} ${report.category} ${report.type}`.toLowerCase();
    return (report.severity === "Critical" ||
        text.includes("lost time") ||
        text.includes("lti") ||
        text.includes("hospital") ||
        text.includes("fracture") ||
        text.includes("medical treatment") ||
        text.includes("time off work"));
}
function isRecordable(report) {
    const text = `${report.description} ${report.category} ${report.type}`.toLowerCase();
    return (isLikelyLti(report) ||
        report.severity === "High" ||
        text.includes("injury") ||
        text.includes("illness") ||
        text.includes("burn") ||
        text.includes("cut") ||
        text.includes("chemical exposure"));
}
function countBy(rows) {
    const counts = new Map();
    for (const row of rows.filter(Boolean)) {
        counts.set(row, (counts.get(row) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}
function detectIntent(query) {
    const text = query.toLowerCase();
    return {
        wantsTrend: /trend|monthly|month|graph|chart|ytd|year to date|movement|pattern/.test(text),
        wantsKpis: /kpi|rate|trir|ltifr|ltisr|manhour|man hour|workforce|scorecard|indicator/.test(text),
        wantsLocations: /location|site|department|area|hotspot|top rated|lowest rated|highest rated/.test(text),
        wantsSeverity: /severity|critical|high|medium|low|serious/.test(text),
        wantsStatus: /status|open|closed|pending|overdue|recurring|in progress|closure/.test(text),
        wantsNearMiss: /near miss|near-miss|leading indicator/.test(text),
        wantsRecordable: /recordable|trir|lti|ltifr|lost time|medical treatment/.test(text),
        wantsActions: /action|recommend|management|what should|next step|capa|corrective/.test(text),
        wantsExecutiveReport: /report|executive|management review|board|summary|pack/.test(text),
    };
}
function isStatus(report, status) {
    return report.status.toLowerCase() === status.toLowerCase();
}
function isPending(report) {
    return /pending|in progress|assigned|review/i.test(report.status);
}
function isRecurringCandidate(report, allReports) {
    const sameRisk = allReports.filter((item) => item.id !== report.id &&
        item.location === report.location &&
        item.category === report.category);
    return sameRisk.length >= 2;
}
function percentage(part, total) {
    return total ? `${Math.round((part / total) * 100)}%` : "0%";
}
function requireCitations(settings) {
    return Boolean(settings.requireCitations ?? settings.requireCitation ?? true);
}
function sourceIds(reports, predicate, limit = 12) {
    const scoped = predicate ? reports.filter(predicate) : reports;
    return [...new Set(scoped.map((report) => report.id).filter(Boolean))].slice(0, limit);
}
function sourceNote(ids) {
    return ids.length ? `Sources: ${ids.join(", ")}` : "Sources: none";
}
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function confidenceFromData(total, trendMonths) {
    if (total >= 25 && trendMonths >= 6)
        return { score: 0.9, level: "very-high" };
    if (total >= 10 && trendMonths >= 3)
        return { score: 0.84, level: "high" };
    if (total >= 3)
        return { score: 0.72, level: "medium" };
    return { score: 0.58, level: "low" };
}
function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function locationScore(reports, location) {
    const scoped = reports.filter((report) => report.location === location);
    const total = Math.max(1, scoped.length);
    const critical = scoped.filter((report) => report.severity === "Critical").length;
    const open = scoped.filter((report) => report.status === "Open").length;
    const overdue = scoped.filter(isOverdue).length;
    const raw = 100 -
        (critical / total) * 120 -
        (open / total) * 40 -
        (overdue / total) * 60;
    return Math.max(0, Math.min(100, Math.round(raw)));
}
function formatPeriod(filters) {
    if (filters?.dateFrom || filters?.dateTo) {
        return `${filters.dateFrom ?? "start"} to ${filters.dateTo ?? "today"}`;
    }
    return `${new Date().getFullYear()} YTD`;
}
function isoDate(value) {
    return value.toISOString().slice(0, 10);
}
function startOfYear(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}
function startOfMonth(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}
function daysAgo(value, days) {
    const copy = new Date(value);
    copy.setUTCDate(copy.getUTCDate() - days);
    return copy;
}
function planAiQuery(input, _intent) {
    const now = new Date();
    const text = input.query.toLowerCase();
    const responseFilters = {
        dateFrom: input.filters?.dateFrom,
        dateTo: input.filters?.dateTo,
        location: input.filters?.location,
        department: input.filters?.department,
        severity: input.filters?.severity,
        status: input.filters?.status,
        category: input.filters?.category,
    };
    const inferredConstraints = [];
    if (!responseFilters.dateFrom && !responseFilters.dateTo) {
        if (/\btoday\b/.test(text)) {
            responseFilters.dateFrom = isoDate(now);
            responseFilters.dateTo = isoDate(now);
            inferredConstraints.push("Applied 'today' date window from the user question.");
        }
        else if (/this week|weekly|last 7 days/.test(text)) {
            responseFilters.dateFrom = isoDate(daysAgo(now, 6));
            responseFilters.dateTo = isoDate(now);
            inferredConstraints.push("Applied a 7-day reporting window from the user question.");
        }
        else if (/this month|month to date|mtd/.test(text)) {
            responseFilters.dateFrom = isoDate(startOfMonth(now));
            responseFilters.dateTo = isoDate(now);
            inferredConstraints.push("Applied month-to-date filtering from the user question.");
        }
        else {
            responseFilters.dateFrom = isoDate(startOfYear(now));
            responseFilters.dateTo = isoDate(now);
            inferredConstraints.push("Applied year-to-date filtering by default.");
        }
    }
    if (!responseFilters.status) {
        if (/\bopen\b/.test(text)) {
            responseFilters.status = "Open";
            inferredConstraints.push("Filtered to open records from the user question.");
        }
        else if (/\bclosed\b/.test(text)) {
            responseFilters.status = "Closed";
            inferredConstraints.push("Filtered to closed records from the user question.");
        }
    }
    if (!responseFilters.severity) {
        if (/\bcritical\b/.test(text)) {
            responseFilters.severity = "Critical";
            inferredConstraints.push("Filtered to critical severity from the user question.");
        }
        else if (/\bhigh\b/.test(text)) {
            responseFilters.severity = "High";
            inferredConstraints.push("Filtered to high severity from the user question.");
        }
        else if (/\bmedium\b/.test(text)) {
            responseFilters.severity = "Medium";
            inferredConstraints.push("Filtered to medium severity from the user question.");
        }
        else if (/\blow\b/.test(text)) {
            responseFilters.severity = "Low";
            inferredConstraints.push("Filtered to low severity from the user question.");
        }
    }
    const reportFilters = {
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
function applyAiFilters(reports, input) {
    const query = input.query.toLowerCase();
    const year = new Date().getFullYear();
    const inferredYtd = query.includes("ytd") ||
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
        if (!date)
            return false;
        if (from && date < from)
            return false;
        if (to && date > to)
            return false;
        if (input.filters?.location && report.location !== input.filters.location)
            return false;
        if (input.filters?.department &&
            report.department !== input.filters.department)
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
function buildHtmlExport(report) {
    const rows = report.trends
        .map((row) => `<tr><td>${escapeHtml(row.month)}</td><td>${escapeHtml(row.unsafeActs)}</td><td>${escapeHtml(row.unsafeConditions)}</td><td>${escapeHtml(row.total)}</td><td>${escapeHtml(row.highestRatedLocation ?? "")} ${escapeHtml(row.highestRatedScore ?? "")}</td><td>${escapeHtml(row.lowestRatedLocation ?? "")} ${escapeHtml(row.lowestRatedScore ?? "")}</td></tr>`)
        .join("");
    const kpis = report.kpis
        .map((kpi) => `<div class="kpi"><strong>${escapeHtml(kpi.value)}</strong><br>${escapeHtml(kpi.label)}<br><small>${escapeHtml(kpi.note ?? "")}</small></div>`)
        .join("");
    const tables = (report.tables ?? [])
        .map((table) => `<h2>${escapeHtml(table.title)}</h2><table><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
        .join("");
    const warnings = (report.assumptions ?? [])
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033}h1,h2{color:#082d63}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid #d0d5dd;border-radius:8px;padding:10px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #d0d5dd;padding:8px;text-align:left}th{background:#f2f4f7}</style></head><body><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.executiveSummary)}</p><div class="kpis">${kpis}</div><h2>Trend Explanation</h2>${report.interpretation.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<h2>Monthly Trend Data</h2><table><thead><tr><th>Month</th><th>Unsafe Acts</th><th>Unsafe Conditions</th><th>Total</th><th>Highest Rated</th><th>Lowest Rated</th></tr></thead><tbody>${rows}</tbody></table>${tables}<h2>Recommended Actions</h2><ol>${report.recommendedActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ol><h2>Warnings And Assumptions</h2><ul>${warnings}</ul><h2>Sources</h2><p>${escapeHtml(report.sources.join(", "))}</p></body></html>`;
}
function compactReportEvidence(report) {
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
export class ReportQueryEngine {
    deps;
    reports = new ReportsService();
    constructor(deps) {
        this.deps = deps;
    }
    async getReportSummary(filters, fallbackReports = []) {
        const maybeReports = this.reports;
        if (typeof maybeReports.summary === "function") {
            return maybeReports.summary(filters);
        }
        const reports = fallbackReports;
        const total = reports.length;
        const open = reports.filter((report) => report.status === "Open").length;
        const closed = reports.filter((report) => report.status === "Closed").length;
        const criticalOpen = reports.filter((report) => report.severity === "Critical" && report.status !== "Closed").length;
        const overdue = reports.filter(isOverdue).length;
        const recordableIncidents = reports.filter(isRecordable).length;
        const nearMissCount = reports.filter((report) => report.isNearMiss || /near miss|near-miss/i.test(`${report.description} ${report.category}`)).length;
        const severityCounts = {
            Critical: reports.filter((report) => report.severity === "Critical").length,
            High: reports.filter((report) => report.severity === "High").length,
            Medium: reports.filter((report) => report.severity === "Medium").length,
            Low: reports.filter((report) => report.severity === "Low").length,
        };
        return {
            total,
            open,
            closed,
            criticalOpen,
            overdue,
            recordableIncidents,
            nearMissCount,
            severityCounts,
        };
    }
    async getTopReporters(limit, fallbackReports = []) {
        const maybeReports = this.reports;
        if (typeof maybeReports.topReportersMonthToDate === "function") {
            return maybeReports.topReportersMonthToDate(limit).catch(() => []);
        }
        return countBy(fallbackReports
            .map((report) => report.reporter)
            .filter((reporter) => Boolean(reporter))).slice(0, limit).map(([reporter, reportCount]) => ({ reporter, reportCount }));
    }
    async generateEvidenceBoundAnswer(input) {
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
        console.log("[ai-debug] generateEvidenceBoundAnswer start");
        const answer = await this.deps.llm.generate("You are Crown Safety Data AI. Answer only from the trusted analytics context you are given. Do not invent KPIs, counts, dates, locations, departments, or incidents. If the context is insufficient, say exactly what is missing. Use a concise executive tone. Cite report IDs inline when making factual claims.", [
            `User question: ${input.question}`,
            `Period: ${input.period}`,
            `Trusted analytics context JSON: ${JSON.stringify(trustedContext)}`,
            "Return a short answer with:",
            "1. direct answer",
            "2. supporting evidence",
            "3. immediate actions if relevant",
        ].join("\n\n"), { temperature: 0.1, maxTokens: 900 });
        console.log("[ai-debug] generateEvidenceBoundAnswer end");
        return { answer, trustedContext };
    }
    async executeReportQuery(input) {
        const intent = detectIntent(input.governedInput.query);
        const planned = planAiQuery(input.governedInput, intent);
        const plannedInput = {
            ...input.governedInput,
            filters: planned.responseFilters,
        };
        console.log("[ai-debug] start executeReportQuery");
        const initialResult = await this.reports.list(planned.reportFilters, 1, 10000);
        console.log("[ai-debug] reports.list done", initialResult?.data?.length);
        const reportsData = initialResult.data;
        const [summary, topReporters] = await Promise.all([
            this.getReportSummary(planned.reportFilters, reportsData),
            this.getTopReporters(5, reportsData),
        ]);
        const reports = applyAiFilters(reportsData, plannedInput);
        const total = reports.length;
        if (total === 0) {
            const report = {
                title: `AI EHS Data Intelligence Report - ${formatPeriod(plannedInput.filters)}`,
                query: input.governedInput.query,
                generatedAt: new Date().toISOString(),
                period: formatPeriod(plannedInput.filters),
                executiveSummary: "No matching live backend records were found for this question, so the AI did not generate KPI values or trends.",
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
                    ...planned.inferredConstraints,
                ],
            };
            const output = {
                success: true,
                data: {
                    ...report,
                    export: input.governedInput.exportFormat === "html"
                        ? { format: "html", content: buildHtmlExport(report) }
                        : undefined,
                },
                metadata: {
                    feature: "ai-query",
                    confidence: 1,
                    confidenceLevel: "high",
                    modelVersion: this.deps.model,
                    processingTimeMs: Date.now() - input.startedAt,
                    sources: [],
                    warnings: report.assumptions,
                    guardrails: {
                        permissionAware: true,
                        role: input.role,
                        requireCitations: requireCitations(input.settings),
                        ragSources: input.settings.ragSources,
                        exportsAllowed: Boolean(input.settings.allowExports),
                    },
                },
            };
            await this.deps.savePrediction("ai-query", input.governedInput, output, 1, input.user?.id);
            await this.deps.savePromptAudit({
                feature: "ai-query",
                prompt: input.prompt,
                output,
                confidence: 1,
                user: input.user,
            });
            return output;
        }
        const unsafeActs = reports.filter((report) => report.type === "Unsafe Act").length;
        const unsafeConditions = reports.filter((report) => report.type === "Unsafe Condition").length;
        const open = reports.filter((report) => report.status === "Open").length;
        const closed = reports.filter((report) => report.status === "Closed").length;
        const pending = reports.filter(isPending).length;
        const overdue = reports.filter(isOverdue).length;
        const recurring = reports.filter((report) => isRecurringCandidate(report, reports)).length;
        const recordable = reports.filter(isRecordable).length;
        const lti = reports.filter(isLikelyLti).length;
        const nearMiss = reports.filter((report) => report.isNearMiss).length;
        const topLocations = countBy(reports.map((report) => report.location)).slice(0, 5);
        const topCategories = countBy(reports.map((report) => report.category)).slice(0, 5);
        const severityCounts = countBy(reports.map((report) => report.severity));
        const statusCounts = countBy(reports.map((report) => (isOverdue(report) ? "Overdue" : report.status)));
        const departmentCounts = countBy(reports.map((report) => report.department || "Unspecified")).slice(0, 10);
        const months = new Map();
        for (const report of reports) {
            const date = reportDate(report);
            if (!date)
                continue;
            const key = monthKey(date);
            months.set(key, [...(months.get(key) ?? []), report]);
        }
        const trends = [...months.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([month, rows]) => {
            const locations = countBy(rows.map((report) => report.location)).map(([location, count]) => ({
                location,
                count,
                score: locationScore(rows, location),
            }));
            const ranked = locations.sort((left, right) => left.score - right.score || right.count - left.count);
            const lowest = ranked[0];
            const highest = ranked[ranked.length - 1];
            return {
                month,
                unsafeActs: rows.filter((report) => report.type === "Unsafe Act")
                    .length,
                unsafeConditions: rows.filter((report) => report.type === "Unsafe Condition").length,
                total: rows.length,
                highestRatedLocation: highest?.location,
                highestRatedScore: highest?.score,
                lowestRatedLocation: lowest?.location,
                lowestRatedScore: lowest?.score,
            };
        });
        const latest = trends[trends.length - 1];
        const previous = trends[trends.length - 2];
        const direction = latest && previous
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
                    .filter(([status]) => !["open", "closed", "overdue"].includes(status.toLowerCase()))
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
        const sourceRecords = sourceIds(reports, undefined, input.governedInput.maxSourceRecords);
        const kpiCitations = {
            totalReports: sourceIds(reports),
            unsafeActs: sourceIds(reports, (report) => report.type === "Unsafe Act"),
            unsafeConditions: sourceIds(reports, (report) => report.type === "Unsafe Condition"),
            openActions: sourceIds(reports, (report) => isStatus(report, "Open")),
            overdueActions: sourceIds(reports, isOverdue),
            closedActions: sourceIds(reports, (report) => isStatus(report, "Closed")),
            recordableScreen: sourceIds(reports, isRecordable),
            possibleLti: sourceIds(reports, isLikelyLti),
            nearMisses: sourceIds(reports, (report) => Boolean(report.isNearMiss)),
        };
        const trendExplanation = latest && previous
            ? `${latest.month} changed from ${previous.total} to ${latest.total} reports compared with ${previous.month}, so the selected trend is ${direction}.`
            : "There is not enough monthly history in the filtered live data to calculate a reliable month-on-month direction.";
        const managementActions = [
            overdue > 0
                ? `Escalate ${overdue} overdue action${overdue === 1 ? "" : "s"} today, assign named owners, and require closure evidence.`
                : "Maintain closure discipline; no overdue actions were detected in the selected dataset.",
            open > 0
                ? `Review ${open} open report${open === 1 ? "" : "s"} by severity and due date during the next EHS meeting.`
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
            `The assistant analyzed ${total} live backend report${total === 1 ? "" : "s"} for ${formatPeriod(plannedInput.filters)}. No mock or frontend fallback data was used.`,
            `The dataset contains ${unsafeActs} unsafe act${unsafeActs === 1 ? "" : "s"} and ${unsafeConditions} unsafe condition${unsafeConditions === 1 ? "" : "s"}.`,
            `Closure performance is ${closureRate}% based on ${closed} closed report${closed === 1 ? "" : "s"} out of ${total}.`,
            trendExplanation,
            topLocations[0]
                ? `${topLocations[0][0]} is the leading hotspot by report count.`
                : "No location hotspot could be calculated.",
            topCategories[0]
                ? `${topCategories[0][0]} is the most frequent hazard category.`
                : "No category hotspot could be calculated.",
            requireCitations(input.settings)
                ? `Every numeric finding is backed by source report IDs. ${sourceNote(sourceRecords)}.`
                : "Source citations are optional under current admin guardrail settings.",
            ...planned.inferredConstraints,
        ];
        const selectedTables = [
            ...(intent.wantsTrend || intent.wantsExecutiveReport
                ? [
                    {
                        title: "Monthly Unsafe Acts / Conditions",
                        headers: ["Month", "Unsafe Acts", "Unsafe Conditions", "Total"],
                        rows: trends.map((row) => [
                            row.month,
                            row.unsafeActs,
                            row.unsafeConditions,
                            row.total,
                        ]),
                    },
                ]
                : []),
            ...(intent.wantsTrend || intent.wantsExecutiveReport
                ? (() => {
                    const byYear = {};
                    for (const row of trends) {
                        const year = row.month.slice(-4);
                        if (!byYear[year])
                            byYear[year] = {};
                        if (row.highestRatedScore !== undefined && row.highestRatedLocation) {
                            if (!byYear[year].highest ||
                                row.highestRatedScore > byYear[year].highest.score) {
                                byYear[year].highest = {
                                    location: row.highestRatedLocation,
                                    score: row.highestRatedScore,
                                };
                            }
                        }
                        if (row.lowestRatedScore !== undefined && row.lowestRatedLocation) {
                            if (!byYear[year].lowest ||
                                row.lowestRatedScore < byYear[year].lowest.score) {
                                byYear[year].lowest = {
                                    location: row.lowestRatedLocation,
                                    score: row.lowestRatedScore,
                                };
                            }
                        }
                    }
                    return [
                        {
                            title: "Rated Locations by Year",
                            headers: ["Year", "Highest Rated Location", "Lowest Rated Location"],
                            rows: Object.entries(byYear).map(([year, data]) => [
                                year,
                                data.highest
                                    ? `${data.highest.location} (${data.highest.score}%)`
                                    : "none",
                                data.lowest
                                    ? `${data.lowest.location} (${data.lowest.score}%)`
                                    : "none",
                            ]),
                        },
                    ];
                })()
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
        const tableCitations = Object.fromEntries(selectedTables.map((table) => {
            if (table.title.includes("Monthly"))
                return [table.title, sourceRecords];
            if (table.title.includes("Status")) {
                return [
                    table.title,
                    sourceIds(reports, (report) => report.status !== ""),
                ];
            }
            if (table.title.includes("Location")) {
                return [
                    table.title,
                    sourceIds(reports, (report) => topLocations.some(([location]) => location === report.location)),
                ];
            }
            if (table.title.includes("Department")) {
                return [
                    table.title,
                    sourceIds(reports, (report) => departmentCounts.some(([department]) => department === (report.department || "Unspecified"))),
                ];
            }
            if (table.title.includes("Severity"))
                return [table.title, sourceRecords];
            if (table.title.includes("Recordable")) {
                return [
                    table.title,
                    sourceIds(reports, (report) => isRecordable(report) ||
                        isLikelyLti(report) ||
                        Boolean(report.isNearMiss)),
                ];
            }
            return [table.title, sourceRecords];
        }));
        const actionCitations = managementActions.map((action, index) => ({
            action,
            sources: index === 0
                ? sourceIds(reports, isOverdue)
                : index === 1
                    ? sourceIds(reports, (report) => !isStatus(report, "Closed"))
                    : index === 2
                        ? sourceIds(reports, (report) => isRecurringCandidate(report, reports))
                        : index === 3 && topLocations[0]
                            ? sourceIds(reports, (report) => report.location === topLocations[0]?.[0])
                            : sourceIds(reports, (report) => isRecordable(report) || isLikelyLti(report)),
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
            requireCitations(input.settings)
                ? "Every answer includes backend source report IDs where records are available."
                : "Source citations are optional under current admin policy.",
        ].filter(Boolean);
        const confidence = confidenceFromData(total, trends.length);
        const citedReports = reports.slice(0, input.governedInput.maxSourceRecords);
        const sqlFirst = await this.generateEvidenceBoundAnswer({
            question: input.governedInput.query,
            role: input.role,
            period: formatPeriod(plannedInput.filters),
            filters: plannedInput.filters,
            intent,
            summary: {
                total: Number(summary?.total ?? total),
                open: Number(summary?.open ?? open),
                closed: Number(summary?.closed ?? closed),
                overdue: Number(summary?.overdue ?? overdue),
                criticalOpen: Number(summary?.criticalOpen ?? 0),
                avgResolution: Number(summary?.avgResolution ?? 0),
                recordableIncidents: Number(summary?.recordableIncidents ?? recordable),
                lostTimeInjuries: Number(summary?.lostTimeInjuries ?? lti),
                medicalTreatmentCases: Number(summary?.medicalTreatmentCases ?? 0),
                nearMissCount: Number(summary?.nearMissCount ?? nearMiss),
                daysSinceLastLti: Number(summary?.daysSinceLastLti ?? -1),
                totalManhoursWorked: Number(summary?.totalManhoursWorked ?? 0),
                totalWorkforce: Number(summary?.totalWorkforce ?? 0),
                severityCounts: typeof summary?.severityCounts === "object" && summary.severityCounts
                    ? summary.severityCounts
                    : undefined,
            },
            topLocations,
            topCategories,
            topReporters,
            trends,
            managementActions,
            citedReports,
        });
        const report = {
            title: `AI EHS Data Intelligence Report - ${formatPeriod(plannedInput.filters)}`,
            query: input.governedInput.query,
            generatedAt: new Date().toISOString(),
            period: formatPeriod(plannedInput.filters),
            executiveSummary: intent.wantsExecutiveReport || intent.wantsTrend || intent.wantsKpis
                ? `The selected live dataset contains ${total} reports for ${formatPeriod(plannedInput.filters)}. The monthly trend is ${direction}, with ${unsafeActs} unsafe acts, ${unsafeConditions} unsafe conditions, ${open} open actions, ${pending} pending/in-progress actions, ${recurring} recurring-risk candidates, and ${overdue} overdue actions.`
                : `Based on live backend records, ${total} reports matched your question. The strongest signals are ${topLocations[0]?.[0] ?? "no clear location hotspot"}, ${topCategories[0]?.[0] ?? "no clear hazard category"}, ${open} open actions, and ${overdue} overdue actions.`,
            kpis: [
                { label: "Total reports", value: total, note: "Filtered backend records" },
                { label: "Unsafe acts", value: unsafeActs, note: "Behaviour/procedure deviations" },
                { label: "Unsafe conditions", value: unsafeConditions, note: "Physical workplace defects" },
                { label: "Open actions", value: open, note: "Awaiting closure" },
                { label: "Overdue actions", value: overdue, note: "Escalation candidates" },
                { label: "Closure rate", value: `${closureRate}%`, note: "Closed / total" },
                { label: "Recordable screen", value: recordable, note: "Requires EHS validation" },
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
            assistantAnswer: sqlFirst.answer,
            queryPlan: {
                strategy: "sql-first-evidence-bound-answering",
                planner: "rule-based-report-query-planner",
                executedSteps: [
                    "Authorized AI access and applied role guardrails",
                    "Planned backend report filters from the user question",
                    "Loaded filtered report dataset from backend service",
                    "Calculated summary KPIs and trend aggregates",
                    "Selected cited source records",
                    "Generated final answer strictly from trusted analytics context",
                ],
                sourcesUsed: ["reports.list", "reports.summary", "reports.topReportersMonthToDate"],
                filtersApplied: plannedInput.filters,
                inferredConstraints: planned.inferredConstraints,
            },
            trustedContext: sqlFirst.trustedContext,
            managementActions,
            recommendedActions: managementActions,
            sources: sourceRecords,
            assumptions: dataQualityWarnings,
        };
        const output = {
            success: true,
            data: {
                ...report,
                export: input.governedInput.exportFormat === "html"
                    ? { format: "html", content: buildHtmlExport(report) }
                    : undefined,
            },
            metadata: {
                feature: "ai-query",
                confidence: confidence.score,
                confidenceLevel: confidence.level,
                modelVersion: this.deps.model,
                processingTimeMs: Date.now() - input.startedAt,
                sources: report.sources,
                warnings: report.assumptions,
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
                    primaryStore: process.env.DATABASE_URL ? "postgresql" : "sqlite",
                    citedRecordCount: citedReports.length,
                },
            },
        };
        await this.deps.savePrediction("ai-query", input.governedInput, output, confidence.score, input.user?.id);
        await this.deps.savePromptAudit({
            feature: "ai-query",
            prompt: input.prompt,
            output,
            confidence: confidence.score,
            user: input.user,
        });
        return output;
    }
}
