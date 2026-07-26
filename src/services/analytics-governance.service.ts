import { v4 as uuidv4 } from "uuid";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

const now = () => new Date().toISOString();

function stringify(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

function parseJson(value: unknown, fallback: unknown) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function actorName(actor?: { name?: string; email?: string }) {
  return actor?.name || actor?.email || "System";
}

function normalizeTemplate(row: any) {
  if (!row) return row;
  return {
    ...row,
    parameters: parseJson(row.parameters, {}),
    outputFormats: parseJson(row.outputFormats, ["pdf", "excel"]),
    approvalRequired: Boolean(row.approvalRequired),
    active: Boolean(row.active),
  };
}

function normalizeSchedule(row: any) {
  if (!row) return row;
  return {
    ...row,
    recipients: parseJson(row.recipients, []),
    active: Boolean(row.active),
  };
}

function normalizeRun(row: any) {
  if (!row) return row;
  return {
    ...row,
    dataQualityWarnings: parseJson(row.dataQualityWarnings, []),
    outputManifest: parseJson(row.outputManifest, {}),
  };
}

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header])).join(","),
    ),
  ].join("\n");
}

function toHtml(title: string, rows: any[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["status"];
  const body = rows.length ? rows : [{ status: "No rows available" }];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d0d5dd;padding:8px;text-align:left}th{background:#f2f4f7}</style></head><body><h1>${title}</h1><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

export class AnalyticsGovernanceService {
  async listTemplates() {
    const result = await pgPool.query(
      "SELECT * FROM analytics_report_templates ORDER BY updatedAt DESC",
    );
    return result.rows.map(normalizeTemplate);
  }

  async createTemplate(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const createdAt = now();
    const template = {
      id: data.id || uuidv4(),
      name: data.name,
      type: data.type || "Management Review",
      description: data.description || null,
      module: data.module || "ehs",
      parameters: stringify(data.parameters, {}),
      outputFormats: stringify(data.outputFormats, ["pdf", "excel"]),
      approvalRequired: data.approvalRequired === false ? false : true,
      ownerId: data.ownerId || null,
      ownerName: data.ownerName || null,
      active: data.active === false ? false : true,
      createdBy: actorName(actor),
      createdAt,
      updatedAt: createdAt,
    };
    await pgPool.query(
      `INSERT INTO analytics_report_templates
        (id, name, type, description, module, parameters, outputFormats, approvalRequired, ownerId, ownerName, active, createdBy, createdAt, updatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      Object.values(template),
    );
    return normalizeTemplate(template);
  }

  async listSchedules() {
    const result = await pgPool.query(
      "SELECT * FROM analytics_report_schedules ORDER BY nextRunAt ASC, updatedAt DESC",
    );
    return result.rows.map(normalizeSchedule);
  }

  async createSchedule(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const createdAt = now();
    const schedule = {
      id: data.id || uuidv4(),
      templateId: data.templateId,
      cadence: data.cadence || "monthly",
      timezone: data.timezone || "Africa/Nairobi",
      recipients: stringify(data.recipients, []),
      nextRunAt: data.nextRunAt || null,
      lastRunAt: null,
      active: data.active === false ? false : true,
      createdBy: actorName(actor),
      createdAt,
      updatedAt: createdAt,
    };
    await pgPool.query(
      `INSERT INTO analytics_report_schedules
        (id, templateId, cadence, timezone, recipients, nextRunAt, lastRunAt, active, createdBy, createdAt, updatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      Object.values(schedule),
    );
    return normalizeSchedule(schedule);
  }

  async generateRun(
    data: Record<string, any>,
    actor?: { name?: string; email?: string },
  ) {
    const warnings = await this.dataQualityWarnings();
    const generatedAt = now();
    const outputManifest = {
      exports: ["json", "html", "csv"],
      packs: data.packType ? [data.packType] : [],
      generatedAt,
    };
    const run = {
      id: uuidv4(),
      templateId: data.templateId || null,
      scheduleId: data.scheduleId || null,
      status: "Generated",
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      dataQualityWarnings: stringify(warnings, []),
      outputManifest: stringify(outputManifest, {}),
      generatedBy: actorName(actor),
      generatedAt,
    };
    await pgPool.query(
      `INSERT INTO analytics_report_runs
        (id, templateId, scheduleId, status, periodStart, periodEnd, dataQualityWarnings, outputManifest, generatedBy, generatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      Object.values(run),
    );
    return normalizeRun(run);
  }

  async signoff(
    runId: string,
    data: Record<string, any>,
    actor?: { id?: string; name?: string; email?: string },
  ) {
    const signedAt = now();
    const signoff = {
      id: uuidv4(),
      runId,
      status: data.status || "Approved",
      signerId: actor?.id || actor?.email || "unknown",
      signerName: actorName(actor),
      comments: data.comments || null,
      signedAt,
    };
    await pgPool.query(
      `INSERT INTO analytics_report_signoffs
        (id, runId, status, signerId, signerName, comments, signedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      Object.values(signoff),
    );
    await pgPool.query(
      "UPDATE analytics_report_runs SET status = $1 WHERE id = $2",
      [signoff.status, runId],
    );
    return signoff;
  }

  async managementPack(
    type: "management-review" | "board-kpi" | "regulatory",
    actor?: { name?: string; email?: string },
  ) {
    const result = await pgPool.query(
      "SELECT * FROM reports ORDER BY date DESC LIMIT 1000",
    );
    const reports = result.rows;
    const open = reports.filter((row) => row.status !== "Closed").length;
    const overdue = reports.filter(
      (row) =>
        row.due_at &&
        row.status !== "Closed" &&
        new Date(row.due_at) < new Date(),
    ).length;
    const generatedRun = await this.generateRun({ packType: type }, actor);
    return {
      type,
      generatedAt: generatedRun.generatedAt,
      runId: generatedRun.id,
      kpis: {
        totalReports: reports.length,
        openReports: open,
        closedReports: reports.length - open,
        overdueReports: overdue,
      },
      sections: [
        "Executive KPI summary",
        "Incident and unsafe act/condition trend",
        "Corrective action ageing",
        "Legal and ISO compliance attention points",
        "Management decisions and signoff",
      ],
      dataQualityWarnings: generatedRun.dataQualityWarnings,
    };
  }

  async dataQualityWarnings() {
    const result = await pgPool.query("SELECT * FROM reports");
    const rows = result.rows;
    const warnings: string[] = [];
    const required = [
      "id",
      "date",
      "location",
      "severity",
      "status",
      "category",
      "type",
    ];
    for (const field of required) {
      const missing = rows.filter(
        (row) =>
          row[field] === undefined || row[field] === null || row[field] === "",
      ).length;
      if (missing) warnings.push(`${missing} report(s) are missing ${field}.`);
    }
    const future = rows.filter(
      (row) => row.date && new Date(row.date) > new Date(),
    ).length;
    if (future) warnings.push(`${future} report(s) have future dates.`);
    const duplicateIds = rows.length - new Set(rows.map((row) => row.id)).size;
    if (duplicateIds)
      warnings.push(`${duplicateIds} duplicate report id(s) detected.`);
    return warnings;
  }

  async exportRows(format: string) {
    const result = await pgPool.query(
      "SELECT * FROM reports ORDER BY date DESC LIMIT 1000",
    );
    const rows = result.rows;
    if (format === "csv" || format === "excel") {
      return {
        contentType: "text/csv",
        body: toCsv(rows),
        fileName: "ehs-reports.csv",
      };
    }
    if (format === "html" || format === "pdf") {
      return {
        contentType: "text/html",
        body: toHtml("EHS Governed Report Export", rows),
        fileName: "ehs-reports.html",
      };
    }
    return {
      contentType: "application/json",
      body: JSON.stringify(rows, null, 2),
      fileName: "ehs-reports.json",
    };
  }
}