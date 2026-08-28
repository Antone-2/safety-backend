import { LlmClient } from "./infra/llm.client.js";
import { RagEngine } from "./infra/rag.engine.js";
import { detectAiQueryDomain, OperationalQueryEngine, } from "./infra/operational-query.engine.js";
import { ReportQueryEngine } from "./infra/report-query.engine.js";
import { AiRepository } from "./ai.repository.js";
import { createHash } from "crypto";
import { ReportsService } from "../reports/reports.service.js";
import { ComplianceService } from "../compliance/compliance.service.js";
import { ComplianceRepository } from "../compliance/compliance.repository.js";
import { TrainingService } from "../training/training.service.js";
import { TrainingRepository } from "../training/training.repository.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
function buildResponse(feature, content, modelVersion, confidence = 0.7) {
    return {
        feature,
        model: modelVersion,
        confidence,
        generatedAt: new Date().toISOString(),
        content,
    };
}
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
    for (const row of rows.filter(Boolean))
        counts.set(row, (counts.get(row) ?? 0) + 1);
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
function buildChatbotSuggestedActions(message, sources) {
    const text = message.toLowerCase();
    const actions = [];
    if (sources[0]?.title) {
        actions.push(`Review ${sources[0].title} and confirm the applicable local control steps.`);
    }
    if (/spill|chemical|exposure/.test(text)) {
        actions.push("Verify spill response controls, PPE readiness, and medical escalation steps before work continues.");
    }
    if (/investigation|incident|near miss/.test(text)) {
        actions.push("Capture facts, witnesses, and immediate controls while the event details are still fresh.");
    }
    if (/training|competency|induction/.test(text)) {
        actions.push("Confirm the affected team has current training records and schedule any missing refreshers.");
    }
    if (actions.length === 0) {
        actions.push("Validate the guidance against the cited procedure or policy before issuing instructions to the team.");
    }
    return uniqueStrings(actions).slice(0, 3);
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
function sentenceCaseList(items) {
    return items.filter(Boolean).map((item) => item.trim());
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}
function tokenize(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3);
}
function firstMeaningfulSentence(text) {
    const normalized = String(text ?? "").trim();
    if (!normalized)
        return "";
    const [sentence] = normalized.split(/(?<=[.!?])\s+/);
    return sentence?.trim() || normalized;
}
function inferCategoryFromText(text) {
    const normalized = text.toLowerCase();
    if (/chemical|spill|exposure/.test(normalized))
        return "Chemical Safety";
    if (/guard|machine|equipment/.test(normalized))
        return "Machine Guarding";
    if (/fire|exit|evac/.test(normalized))
        return "Emergency Preparedness";
    if (/fall|height|ladder|scaffold/.test(normalized))
        return "Work At Height";
    if (/ppe|helmet|glove|goggle/.test(normalized))
        return "PPE Compliance";
    return "General Safety";
}
function inferSeverityFromText(text) {
    const normalized = text.toLowerCase();
    if (/fatal|hospital|fracture|amputation|critical|medical treatment/.test(normalized))
        return "Critical";
    if (/injury|burn|chemical|spill|high/.test(normalized))
        return "High";
    if (/near miss|medium|unsafe/.test(normalized))
        return "Medium";
    return "Low";
}
function inferWitnessNames(statements) {
    return uniqueStrings(statements.flatMap((statement) => {
        const prefix = statement.split(/:| - /)[0]?.trim();
        if (prefix && /\s/.test(prefix) && prefix.length <= 60)
            return [prefix];
        return [];
    }));
}
function relatedReportScore(report, input) {
    let score = 0;
    if (input.incidentId && report.id === input.incidentId)
        score += 50;
    if (input.location && report.location === input.location)
        score += 8;
    if (input.department && report.department === input.department)
        score += 6;
    const inputTokens = new Set(tokenize(input.description));
    const reportTokens = tokenize(`${report.description} ${report.category} ${report.type} ${report.location} ${report.department ?? ""}`);
    for (const token of reportTokens) {
        if (inputTokens.has(token))
            score += 2;
    }
    return score;
}
function buildInvestigationQuestions(input) {
    const normalized = input.description.toLowerCase();
    const questions = [
        `What task was being performed immediately before the ${input.category.toLowerCase()} event occurred?`,
        "Which control failed, was missing, or was bypassed at the point of work?",
        "What immediate conditions made the event possible, and why were they not corrected earlier?",
        "What supervision, permit, or pre-task verification should have detected the risk before exposure?",
    ];
    if (input.severity === "Critical" || /injury|medical treatment|hospital/.test(normalized)) {
        questions.push("What injury mechanism or exposure pathway caused the actual or potential harm, and how can it be eliminated?");
    }
    if (/chemical|spill|exposure/.test(normalized)) {
        questions.push("Were the correct SDS, containment, and decontamination controls available and understood before the task started?");
    }
    if (input.relatedIncidents.length > 0) {
        questions.push(`Do the related reports (${input.relatedIncidents.join(", ")}) show a recurring risk that requires a systemic fix?`);
    }
    if (input.witnessStatements.length > 0) {
        questions.push("Where do witness accounts align or conflict, and what evidence is needed to resolve those differences?");
    }
    if (input.evidence.length > 0) {
        questions.push("Which physical or documentary evidence best proves the timeline, equipment condition, and control status?");
    }
    return uniqueStrings(questions).slice(0, 8);
}
function buildInvestigationActions(input) {
    const actions = [
        "Secure the scene, preserve evidence, and confirm immediate controls remain in place.",
        "Validate the job steps, permit conditions, and supervisor checks against what actually happened.",
        "Assign corrective actions with owners and due dates for each failed or missing control.",
    ];
    if (input.severity === "Critical") {
        actions.unshift("Escalate the case for management review and confirm whether regulatory notification thresholds were met.");
    }
    if (input.relatedIncidents.length > 0) {
        actions.push("Review the recurring pattern across related reports and raise a preventive CAPA if the same risk has repeated.");
    }
    if (input.category === "Chemical Safety") {
        actions.push("Reconfirm SDS access, spill response readiness, and chemical handling training before work restarts.");
    }
    return actions;
}
function buildInvestigationContent(input) {
    const summary = [
        `Likely classification: ${input.severity} severity, ${input.category}.`,
        input.entities.where ? `Primary location: ${input.entities.where}.` : undefined,
        input.entities.what ? `Event summary: ${input.entities.what}` : undefined,
        input.relatedIncidents.length
            ? `Related report references: ${input.relatedIncidents.join(", ")}.`
            : "No closely related backend report references were found from the supplied context.",
    ]
        .filter(Boolean)
        .join(" ");
    const questions = input.suggestedQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n");
    const actions = input.recommendedActions.map((action, index) => `${index + 1}. ${action}`).join("\n");
    return `${summary}\n\nInvestigation questions:\n${questions}\n\nRecommended actions:\n${actions}`;
}
function dateValue(value) {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function complianceRiskLabel(input) {
    if (input.nonCompliant >= 3 || input.overdue >= 3 || input.openAudits >= 3)
        return "High";
    if (input.nonCompliant > 0 || input.pending > 0 || input.openAudits > 0)
        return "Medium";
    if (input.total > 0)
        return "Low";
    return "Unknown";
}
function summarizeComplianceGaps(input) {
    if (!input.includeGaps)
        return [];
    const gaps = [];
    for (const obligation of input.obligations) {
        if (obligation.status === "Non-Compliant") {
            gaps.push(`${obligation.title} is non-compliant for ${obligation.site}/${obligation.department}.`);
        }
        else if (obligation.status === "Pending" && !obligation.evidence) {
            gaps.push(`${obligation.title} is still pending and has no evidence attached yet.`);
        }
    }
    for (const audit of input.audits) {
        if (audit.status === "In Progress") {
            gaps.push(`${audit.title} remains in progress for ${audit.site}/${audit.department}, so closure evidence should be confirmed.`);
        }
        else if (audit.status === "Planned") {
            gaps.push(`${audit.title} is still planned and may leave the assurance schedule exposed until execution starts.`);
        }
    }
    return uniqueStrings(gaps).slice(0, 8);
}
function buildComplianceActions(input) {
    const actions = [
        "Confirm each applicable obligation has a named owner, current evidence, and a valid next review date.",
        "Review the highest-risk obligations first and update closure dates for any non-compliant or overdue items.",
    ];
    if (input.audits.some((audit) => audit.status === "In Progress")) {
        actions.push("Close out open audit workpapers and verify that findings have owners, due dates, and evidence of completion.");
    }
    if (input.gapSummary.length > 0) {
        actions.push("Convert the identified gaps into tracked CAPA or compliance follow-up actions with management visibility.");
    }
    if (input.obligations.some((obligation) => obligation.status === "Pending")) {
        actions.push("Escalate long-pending obligations so evidence collection and review do not slip past their control cycle.");
    }
    return uniqueStrings(actions).slice(0, 6);
}
function buildComplianceNarrative(input) {
    const scope = [
        input.regulation ? `Regulation focus: ${input.regulation}.` : undefined,
        input.siteId ? `Site: ${input.siteId}.` : undefined,
        input.department ? `Department: ${input.department}.` : undefined,
        input.auditId ? `Audit reference: ${input.auditId}.` : undefined,
    ]
        .filter(Boolean)
        .join(" ");
    const summary = `Compliance risk is ${input.riskLevel}. Reviewed ${input.totals.obligations} obligation(s) and ${input.totals.audits} audit record(s): ${input.totals.compliant} compliant, ${input.totals.nonCompliant} non-compliant, ${input.totals.pending} pending, ${input.totals.overdue} overdue, ${input.totals.openAudits} audit(s) still open.`;
    const gaps = input.topGaps.length
        ? `Top gaps:\n${input.topGaps.map((gap, index) => `${index + 1}. ${gap}`).join("\n")}`
        : "No major gaps were surfaced from the filtered live compliance records.";
    const actions = `Recommended actions:\n${input.recommendedActions
        .map((action, index) => `${index + 1}. ${action}`)
        .join("\n")}`;
    return [scope, summary, gaps, actions].filter(Boolean).join("\n\n");
}
function trainingPriorityLabel(input) {
    if (input.expired > 0 || (input.incidentLinked && input.mandatoryMatches > 0))
        return "High";
    if (input.overdueOrScheduled > 0 || input.mandatoryMatches > 0)
        return "Medium";
    return "Low";
}
function buildTrainingGaps(input) {
    const gaps = [];
    for (const record of input.records) {
        if (record.status === "Expired") {
            gaps.push(`${record.employeeName} has expired training for ${input.coursesById.get(record.courseId)?.title ?? record.courseId}.`);
        }
        else if (record.status === "Scheduled" || record.status === "In Progress") {
            gaps.push(`${record.employeeName} still has ${record.status.toLowerCase()} training that has not been completed yet.`);
        }
    }
    for (const entry of input.matrix) {
        if (entry.mandatory) {
            const matched = input.records.some((record) => record.courseId === entry.courseId);
            if (!matched) {
                gaps.push(`Mandatory matrix requirement for ${entry.role}/${entry.department} is not evidenced by a matching training record for ${input.coursesById.get(entry.courseId)?.title ?? entry.courseId}.`);
            }
        }
    }
    return uniqueStrings(gaps).slice(0, 8);
}
function buildTrainingActions(input) {
    const actions = [
        "Confirm the worker or role is mapped to the correct mandatory matrix requirements and supervisors understand the expectation.",
        "Verify completion evidence, trainer sign-off, and expiry dates for all critical courses in scope.",
    ];
    if (input.records.some((record) => record.status === "Expired")) {
        actions.push("Prioritize immediate refresher or recertification training for expired records before the task continues.");
    }
    if (input.incidentLinked) {
        actions.push("Review whether the incident or near miss indicates a competency gap, then add targeted retraining and supervisor verification.");
    }
    if (input.gaps.length > 0) {
        actions.push("Convert uncovered training gaps into tracked actions with owners, target dates, and closure evidence.");
    }
    if (input.matrix.some((entry) => entry.mandatory)) {
        actions.push("Check that mandatory course frequencies in the training matrix still match operational and regulatory risk.");
    }
    return uniqueStrings(actions).slice(0, 6);
}
function buildTrainingNarrative(input) {
    const scope = [
        input.employeeId ? `Employee: ${input.employeeId}.` : undefined,
        input.role ? `Role: ${input.role}.` : undefined,
        input.department ? `Department: ${input.department}.` : undefined,
        input.siteId ? `Site: ${input.siteId}.` : undefined,
        input.incidentId ? `Incident reference: ${input.incidentId}.` : undefined,
        `Recommendation scope limited to ${input.limit} record(s).`,
    ]
        .filter(Boolean)
        .join(" ");
    const summary = `Training priority is ${input.stats.priority}. Reviewed ${input.stats.records} training record(s), ${input.stats.courses} course definition(s), and ${input.stats.mandatoryMatches} mandatory matrix match(es). ${input.stats.expired} expired and ${input.stats.open} still scheduled or in-progress record(s) were found.`;
    const gaps = input.gaps.length
        ? `Training gaps:\n${input.gaps.map((gap, index) => `${index + 1}. ${gap}`).join("\n")}`
        : "No major training gaps were surfaced from the filtered live records.";
    const actions = `Recommended actions:\n${input.actions
        .map((action, index) => `${index + 1}. ${action}`)
        .join("\n")}`;
    return [scope, summary, gaps, actions].filter(Boolean).join("\n\n");
}
export class AiService {
    llm = new LlmClient();
    rag = new RagEngine();
    repository = new AiRepository();
    reports = new ReportsService();
    compliance = new ComplianceService(new ComplianceRepository());
    training = new TrainingService(new TrainingRepository(pgPool));
    model = process.env.AI_MODEL || "local-fallback";
    operationalQueryEngine = new OperationalQueryEngine({
        llm: this.llm,
        model: this.model,
        savePrediction: (feature, input, output, confidence, userId) => this.savePredictionBestEffort(feature, input, output, confidence, userId).then(() => undefined),
        savePromptAudit: (input) => this.savePromptAuditBestEffort(input),
    });
    reportQueryEngine = new ReportQueryEngine({
        llm: this.llm,
        model: this.model,
        savePrediction: (feature, input, output, confidence, userId) => this.savePredictionBestEffort(feature, input, output, confidence, userId).then(() => undefined),
        savePromptAudit: (input) => this.savePromptAuditBestEffort(input),
    });
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
        const answer = await this.llm.generate([
            "You are Crown Safety Data AI.",
            "Answer only from the trusted analytics context you are given.",
            "Do not invent KPIs, counts, dates, locations, departments, or incidents.",
            "If the context is insufficient, say exactly what is missing.",
            "Use a concise executive tone.",
            "Cite report IDs inline when making factual claims.",
        ].join(" "), [
            `User question: ${input.question}`,
            `Period: ${input.period}`,
            `Trusted analytics context JSON: ${JSON.stringify(trustedContext)}`,
            "Return a short answer with:",
            "1. direct answer",
            "2. supporting evidence",
            "3. immediate actions if relevant",
        ].join("\n\n"), { temperature: 0.1, maxTokens: 900 });
        return { answer, trustedContext };
    }
    async generate(feature, system, user, userId) {
        const text = await this.llm.generate(system, user, {
            temperature: 0.2,
            maxTokens: 1200,
        });
        const output = buildResponse(feature, text, this.model);
        await this.savePredictionBestEffort(feature, user, output, 0.7, userId);
        return output;
    }
    async savePredictionBestEffort(feature, input, output, confidence, userId) {
        try {
            const inputHash = createHash("sha256")
                .update(JSON.stringify(input))
                .digest("hex");
            return await this.repository.savePrediction(feature, inputHash, output, this.model, confidence, userId);
        }
        catch (error) {
            console.warn("AI prediction audit skipped:", error instanceof Error ? error.message : String(error));
            return undefined;
        }
    }
    async savePromptAuditBestEffort(input) {
        try {
            await this.repository.savePromptAudit({
                userId: input.user?.id,
                userEmail: input.user?.email,
                userRole: input.user?.role,
                feature: input.feature,
                prompt: input.prompt,
                responseSummary: input.output?.data?.executiveSummary ||
                    input.output?.content ||
                    input.output?.data?.title ||
                    undefined,
                modelVersion: this.model,
                confidence: input.confidence,
                sources: input.output?.metadata?.sources || input.output?.data?.sources || [],
                warnings: input.output?.metadata?.warnings ||
                    input.output?.data?.assumptions ||
                    [],
                denied: input.denied,
                denialReason: input.denialReason,
            });
        }
        catch (error) {
            console.warn("AI prompt audit skipped:", error instanceof Error ? error.message : String(error));
        }
    }
    async query(data, user) {
        const startedAt = Date.now();
        const settings = (await this.repository.getGuardrailSettings());
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
            maxSourceRecords: Math.min(data.maxSourceRecords, Number(settings.maxSourceRecords || 50)),
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
    async investigationAssistant(data, userId) {
        const input = {
            incidentId: String(data?.incidentId ?? "").trim() || undefined,
            type: String(data?.type ?? "").trim() || undefined,
            description: String(data?.description ?? "").trim(),
            evidence: sentenceCaseList(Array.isArray(data?.evidence) ? data.evidence.map(String) : []),
            witnessStatements: sentenceCaseList(Array.isArray(data?.witnessStatements)
                ? data.witnessStatements.map(String)
                : []),
            location: String(data?.location ?? "").trim() || undefined,
            department: String(data?.department ?? "").trim() || undefined,
        };
        const related = await this.reports
            .list({
            all: true,
            location: input.location,
            department: input.department,
        }, 1, 100)
            .then((result) => result.data)
            .catch(() => []);
        const rankedRelated = related
            .map((report) => ({
            report,
            score: relatedReportScore(report, input),
        }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, 5);
        const primaryMatch = rankedRelated[0]?.report;
        const category = primaryMatch?.category ||
            input.type ||
            inferCategoryFromText(input.description);
        const severity = primaryMatch?.severity || inferSeverityFromText(input.description);
        const witnessNames = inferWitnessNames(input.witnessStatements);
        const relatedIncidentIds = uniqueStrings(rankedRelated.map((entry) => entry.report.id)).slice(0, 5);
        const timeline = [
            ...(primaryMatch
                ? [
                    {
                        timestamp: primaryMatch.date,
                        event: `Matched backend report ${primaryMatch.id}: ${firstMeaningfulSentence(primaryMatch.description)}`,
                        source: primaryMatch.id,
                    },
                ]
                : []),
            ...input.evidence.map((item, index) => ({
                timestamp: new Date().toISOString(),
                event: `Evidence noted ${index + 1}: ${item}`,
                source: "user-evidence",
            })),
            ...input.witnessStatements.map((item, index) => ({
                timestamp: new Date().toISOString(),
                event: `Witness statement ${index + 1}: ${firstMeaningfulSentence(item)}`,
                source: "witness-statement",
            })),
        ].slice(0, 10);
        const entities = {
            who: uniqueStrings([
                ...witnessNames,
                primaryMatch?.reporter,
                input.department ? `${input.department} team` : undefined,
            ]),
            what: firstMeaningfulSentence(input.description),
            where: input.location || primaryMatch?.location,
            when: primaryMatch?.date,
        };
        const suggestedQuestions = buildInvestigationQuestions({
            description: input.description,
            severity,
            category,
            evidence: input.evidence,
            witnessStatements: input.witnessStatements,
            relatedIncidents: relatedIncidentIds,
        });
        const recommendedActions = buildInvestigationActions({
            severity,
            category,
            relatedIncidents: relatedIncidentIds,
        });
        const content = buildInvestigationContent({
            severity,
            category,
            entities,
            relatedIncidents: relatedIncidentIds,
            suggestedQuestions,
            recommendedActions,
        });
        const output = {
            ...buildResponse("investigation-assistant", content, this.model, 0.82),
            data: {
                category,
                severity,
                timeline,
                entities,
                suggestedQuestions,
                relatedIncidents: relatedIncidentIds,
                recommendedActions,
                sources: relatedIncidentIds,
            },
        };
        const predictionId = await this.savePredictionBestEffort("investigation-assistant", input, output, 0.82, userId);
        return predictionId ? { ...output, predictionId } : output;
    }
    async rootCauseAnalysis(data, userId) {
        return this.generate("root-cause-analysis", "You are a root cause analysis expert using ISO 45001 methodology.", `Context: ${JSON.stringify(data)}`, userId);
    }
    async hazardDetection(data, userId) {
        return this.generate("hazard-detection", "Identify safety hazards from the provided description and rate severity.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async riskPrediction(data, userId) {
        return this.generate("risk-prediction", "Predict risk scores for the given operational context.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async chatbot(data, userId) {
        const history = Array.isArray(data?.history) ? data.history : [];
        const message = data.message || data.query || "";
        const conversationId = String(data?.conversationId ?? "").trim() || `ai-chat-${Date.now()}`;
        const retrieved = (await this.rag
            .search(message, { maxResults: 3 })
            .catch(() => []));
        const context = retrieved
            .map((r) => `- ${r.title}: ${r.excerpt}`)
            .join("\n");
        const reply = await this.llm.generate("You are a safety assistant chatbot for Crown Paints EHS. Use the provided knowledge when relevant.", `Knowledge:\n${context}\n\nConversation: ${JSON.stringify(history)}\nUser: ${message}`, { temperature: 0.3 });
        const suggestedActions = buildChatbotSuggestedActions(message, retrieved);
        const output = {
            ...buildResponse("chatbot", reply, this.model, retrieved.length > 0 ? 0.8 : 0.68),
            conversationId,
            sources: retrieved.map((item) => ({
                title: item.title,
                excerpt: item.excerpt,
            })),
            suggestedActions,
        };
        const predictionId = await this.savePredictionBestEffort("chatbot", data, output, retrieved.length > 0 ? 0.8 : 0.68, userId);
        const finalOutput = predictionId ? { ...output, predictionId } : output;
        if (userId) {
            await this.repository.saveChatSession({
                conversationId,
                userId,
                history: [...history, { role: "assistant", content: reply }],
                latestResponse: finalOutput,
            });
        }
        return finalOutput;
    }
    async complianceAssistant(data, userId) {
        const input = {
            siteId: String(data?.siteId ?? "").trim() || undefined,
            regulation: String(data?.regulation ?? "").trim() || undefined,
            auditId: String(data?.auditId ?? "").trim() || undefined,
            department: String(data?.department ?? "").trim() || undefined,
            includeGaps: data?.includeGaps !== false,
        };
        const [obligations, audits] = await Promise.all([
            this.compliance.getObligations({
                ...(input.department ? { department: input.department } : {}),
                ...(input.siteId ? { site: input.siteId } : {}),
            }),
            this.compliance.getAudits({
                ...(input.department ? { department: input.department } : {}),
                ...(input.siteId ? { site: input.siteId } : {}),
            }),
        ]);
        const regulationNeedle = input.regulation?.toLowerCase();
        const scopedObligations = obligations.filter((obligation) => {
            if (regulationNeedle &&
                !`${obligation.legislation} ${obligation.title} ${obligation.requirement}`
                    .toLowerCase()
                    .includes(regulationNeedle)) {
                return false;
            }
            return true;
        });
        const scopedAudits = audits.filter((audit) => {
            if (input.auditId && audit.id !== input.auditId)
                return false;
            if (regulationNeedle &&
                !`${audit.title} ${audit.criteria ?? ""} ${audit.scope ?? ""}`
                    .toLowerCase()
                    .includes(regulationNeedle)) {
                return false;
            }
            return true;
        });
        const now = new Date("2026-08-02T00:00:00.000Z");
        const overdueObligations = scopedObligations.filter((obligation) => {
            const due = dateValue(obligation.dueDate);
            return (obligation.status !== "Compliant" &&
                due !== null &&
                due.getTime() < now.getTime());
        });
        const compliantCount = scopedObligations.filter((obligation) => obligation.status === "Compliant").length;
        const nonCompliantCount = scopedObligations.filter((obligation) => obligation.status === "Non-Compliant").length;
        const pendingCount = scopedObligations.filter((obligation) => obligation.status === "Pending").length;
        const openAuditCount = scopedAudits.filter((audit) => ["Planned", "In Progress"].includes(audit.status)).length;
        const topGaps = summarizeComplianceGaps({
            obligations: scopedObligations,
            audits: scopedAudits,
            includeGaps: input.includeGaps,
        });
        const riskLevel = complianceRiskLabel({
            total: scopedObligations.length,
            nonCompliant: nonCompliantCount,
            pending: pendingCount,
            overdue: overdueObligations.length,
            openAudits: openAuditCount,
        });
        const recommendedActions = buildComplianceActions({
            obligations: scopedObligations,
            audits: scopedAudits,
            gapSummary: topGaps,
        });
        const content = buildComplianceNarrative({
            regulation: input.regulation,
            siteId: input.siteId,
            department: input.department,
            auditId: input.auditId,
            totals: {
                obligations: scopedObligations.length,
                compliant: compliantCount,
                nonCompliant: nonCompliantCount,
                pending: pendingCount,
                overdue: overdueObligations.length,
                audits: scopedAudits.length,
                openAudits: openAuditCount,
            },
            riskLevel,
            topGaps,
            recommendedActions,
        });
        const output = {
            ...buildResponse("compliance-assistant", content, this.model, 0.8),
            data: {
                scope: input,
                summary: {
                    obligations: scopedObligations.length,
                    compliant: compliantCount,
                    nonCompliant: nonCompliantCount,
                    pending: pendingCount,
                    overdue: overdueObligations.length,
                    audits: scopedAudits.length,
                    openAudits: openAuditCount,
                    riskLevel,
                },
                gaps: topGaps,
                recommendedActions,
                matchedObligations: scopedObligations.slice(0, 10).map((obligation) => ({
                    id: obligation.id,
                    title: obligation.title,
                    legislation: obligation.legislation,
                    status: obligation.status,
                    site: obligation.site,
                    department: obligation.department,
                    dueDate: obligation.dueDate,
                })),
                matchedAudits: scopedAudits.slice(0, 10).map((audit) => ({
                    id: audit.id,
                    title: audit.title,
                    status: audit.status,
                    type: audit.type,
                    site: audit.site,
                    department: audit.department,
                })),
            },
        };
        const predictionId = await this.savePredictionBestEffort("compliance-assistant", input, output, 0.8, userId);
        return predictionId ? { ...output, predictionId } : output;
    }
    async trainingRecommendation(data, userId) {
        const input = {
            employeeId: String(data?.employeeId ?? "").trim() || undefined,
            department: String(data?.department ?? "").trim() || undefined,
            role: String(data?.role ?? "").trim() || undefined,
            siteId: String(data?.siteId ?? "").trim() || undefined,
            incidentId: String(data?.incidentId ?? "").trim() || undefined,
            limit: Math.min(Math.max(Number(data?.limit ?? 10) || 10, 1), 50),
        };
        const [courses, records, matrix] = await Promise.all([
            this.training.getCourses().catch(() => []),
            this.training
                .getRecords({
                ...(input.employeeId ? { employeeId: input.employeeId } : {}),
                ...(input.department ? { department: input.department } : {}),
                ...(input.siteId ? { site: input.siteId } : {}),
            })
                .catch(() => []),
            this.training
                .getMatrix({
                ...(input.department ? { department: input.department } : {}),
                ...(input.role ? { role: input.role } : {}),
            })
                .catch(() => []),
        ]);
        const scopedRecords = records.slice(0, input.limit);
        const scopedMatrix = matrix.filter((entry) => {
            if (input.role && entry.role !== input.role)
                return false;
            if (input.department && entry.department !== input.department)
                return false;
            return true;
        });
        const courseMap = new Map(courses.map((course) => [course.id, course]));
        const mandatoryMatches = scopedMatrix.filter((entry) => scopedRecords.some((record) => record.courseId === entry.courseId));
        const expiredRecords = scopedRecords.filter((record) => record.status === "Expired");
        const openRecords = scopedRecords.filter((record) => ["Scheduled", "In Progress"].includes(record.status));
        const gaps = buildTrainingGaps({
            records: scopedRecords,
            matrix: scopedMatrix,
            coursesById: courseMap,
        });
        const priority = trainingPriorityLabel({
            expired: expiredRecords.length,
            overdueOrScheduled: openRecords.length,
            mandatoryMatches: mandatoryMatches.length,
            incidentLinked: Boolean(input.incidentId),
        });
        const recommendedActions = buildTrainingActions({
            records: scopedRecords,
            matrix: scopedMatrix,
            gaps,
            incidentLinked: Boolean(input.incidentId),
        });
        const content = buildTrainingNarrative({
            employeeId: input.employeeId,
            role: input.role,
            department: input.department,
            siteId: input.siteId,
            incidentId: input.incidentId,
            limit: input.limit,
            stats: {
                courses: courses.length,
                records: scopedRecords.length,
                mandatoryMatches: mandatoryMatches.length,
                expired: expiredRecords.length,
                open: openRecords.length,
                priority,
            },
            gaps,
            actions: recommendedActions,
        });
        const output = {
            ...buildResponse("training-recommendation", content, this.model, 0.79),
            data: {
                scope: input,
                summary: {
                    courses: courses.length,
                    records: scopedRecords.length,
                    mandatoryMatches: mandatoryMatches.length,
                    expired: expiredRecords.length,
                    open: openRecords.length,
                    priority,
                },
                gaps,
                recommendedActions,
                matchedRecords: scopedRecords.slice(0, 10).map((record) => ({
                    id: record.id,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    courseId: record.courseId,
                    courseTitle: courseMap.get(record.courseId)?.title ?? record.courseId,
                    status: record.status,
                    expiryDate: record.expiryDate,
                    department: record.department,
                    site: record.site,
                })),
                matchedMatrix: scopedMatrix.slice(0, 10).map((entry) => ({
                    id: entry.id,
                    role: entry.role,
                    department: entry.department,
                    courseId: entry.courseId,
                    courseTitle: courseMap.get(entry.courseId)?.title ?? entry.courseId,
                    frequency: entry.frequency,
                    mandatory: entry.mandatory,
                })),
            },
        };
        const predictionId = await this.savePredictionBestEffort("training-recommendation", input, output, 0.79, userId);
        return predictionId ? { ...output, predictionId } : output;
    }
    async permitValidation(data, userId) {
        return this.generate("permit-validation", "Validate a permit-to-work application and flag missing safety controls.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async inspectionAssistant(data, userId) {
        return this.generate("inspection-assistant", "Generate a safety inspection checklist and findings from the input.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async safetyObservationAnalysis(data, userId) {
        return this.generate("safety-observation-analysis", "Analyze safety observations and suggest themes and actions.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async environmentalMonitoring(data, userId) {
        return this.generate("environmental-monitoring", "Summarize environmental monitoring data and compliance status.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async predictiveAnalytics(data, userId) {
        return this.generate("predictive-analytics", "Produce predictive analytics insights from the supplied metrics.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async dashboardInsights(data, userId) {
        return this.generate("dashboard-insights", "Summarize dashboard metrics into executive insights.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async documentSearch(data, userId) {
        const results = await this.rag
            .search(data.query, {
            category: data.category,
            maxResults: data.maxResults ?? 5,
        })
            .catch(() => []);
        const output = {
            feature: "document-search",
            results,
            generatedAt: new Date().toISOString(),
        };
        const predictionId = await this.savePredictionBestEffort("document-search", data, output, results.length > 0 ? 0.78 : 0.62, userId);
        return predictionId ? { ...output, predictionId } : output;
    }
    async toolboxTalkGenerator(data, userId) {
        return this.generate("toolbox-talk-generator", "Generate a toolbox talk outline for the given topic.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async safetyAlertGenerator(data, userId) {
        return this.generate("safety-alert-generator", "Draft a safety alert message from the input.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async trendAnalysis(data, userId) {
        return this.generate("trend-analysis", "Analyze trends from historical incident data and surface patterns.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async correctiveActionRecommendation(data, userId) {
        return this.generate("corrective-action-recommendation", "Recommend corrective and preventive actions for the described issue.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async kpiForecasting(data, userId) {
        return this.generate("kpi-forecasting", "Forecast EHS KPI values from the provided series.", `Input: ${JSON.stringify(data)}`, userId);
    }
    async executiveReports(data, userId) {
        return this.generate("executive-reports", "Produce a concise executive EHS report from the supplied data.", `Input: ${JSON.stringify(data)}`, userId);
    }
    getRepository() {
        return this.repository;
    }
}
