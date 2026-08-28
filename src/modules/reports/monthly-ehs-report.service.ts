import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";

type MetricCard = {
  key: string;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
  sparkline: number[];
  description: string;
};

type IncidentRecord = {
  id: string;
  date: string;
  type: string;
  location: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: string;
  department: string;
  site: string;
  description: string;
};

type CapaItem = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "Open" | "Closed";
  severity: "Low" | "Medium" | "High" | "Critical";
};

type TrainingItem = {
  name: string;
  department: string;
  completion: number;
  expiryDate: string;
  status: "On track" | "Expiring soon" | "Expired";
};

type SitePerformance = {
  name: string;
  incidents: number;
  riskScore: "Low" | "Medium" | "High";
  trend: "Stable" | "Watch" | "Needs attention";
};

export type MonthlyEhsReportPayload = {
  month: string;
  model: {
    metrics: MetricCard[];
    trendData: Array<{ month: string; incidents: number; closed: number; open: number }>;
    capaTrendData: Array<{ month: string; opened: number; closed: number; overdue: number }>;
    incidentTypes: Array<{ name: string; value: number }>;
    departmentPerformance: Array<{ name: string; value: number }>;
    incidents: IncidentRecord[];
    capas: CapaItem[];
    training: TrainingItem[];
    sites: SitePerformance[];
    notifications: Array<{ title: string; detail: string; href: string }>;
    summaryText: string;
  };
  currentFocus: string;
};

function parseMonth(month?: string) {
  const match = typeof month === "string" ? /^(\d{4})-(\d{2})$/.exec(month) : null;
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const safeMonthIndex = Math.max(0, Math.min(11, monthIndex));
  const start = new Date(Date.UTC(year, safeMonthIndex, 1));
  const next = new Date(Date.UTC(year, safeMonthIndex + 1, 1));
  const trendStart = new Date(Date.UTC(year, safeMonthIndex - 11, 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { month: key, start, next, trendStart };
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
}

function toMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function monthKeysBetween(start: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function asIncident(row: Record<string, unknown>): IncidentRecord {
  const location = String(row.location ?? "Unspecified");
  return {
    id: String(row.id),
    date: toIso(row.date),
    type: String(row.type ?? "Other"),
    location,
    severity: String(row.severity ?? "Low") as IncidentRecord["severity"],
    status: String(row.status ?? "Open"),
    department: String(row.department ?? "Unspecified"),
    site: location,
    description: String(row.description ?? ""),
  };
}

function rankSeverity(severity: string) {
  switch (severity) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    default:
      return 1;
  }
}

export async function getMonthlyEhsReport(month?: string): Promise<MonthlyEhsReportPayload> {
  const { month: monthKey, start, next, trendStart } = parseMonth(month);
  const monthKeys = monthKeysBetween(trendStart, 12);

  const [
    incidentResult,
    capaResult,
    trainingResult,
    complianceResult,
    auditResult,
    legalUpdateResult,
    emissionResult,
    spillResult,
    healthResult,
  ] = await Promise.all([
    pgPool.query(
      `SELECT id, date, type, location, severity, status, department, description
       FROM reports
       WHERE date >= $1 AND date < $2
       ORDER BY date DESC
       LIMIT 5000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, title, owner, priority, status, due_date, completed_date, created_at
       FROM capa
       WHERE created_at < $2
         AND (
           created_at >= $1
           OR completed_date >= $1
           OR due_date >= $1
           OR status NOT IN ('Completed', 'Cancelled')
         )
       ORDER BY created_at DESC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT r.id, r.status, r.department, r.scheduled_date, r.completed_date, r.expiry_date, c.title AS course_title
       FROM training_records r
       LEFT JOIN training_courses c ON c.id = r.course_id
       WHERE r.scheduled_date < $2
         AND (
           r.scheduled_date >= $1
           OR r.completed_date >= $1
           OR r.expiry_date >= $1
           OR r.status = 'Expired'
         )
       ORDER BY COALESCE(r.expiry_date, r.completed_date, r.scheduled_date) ASC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, title, status, due_date, created_at
       FROM compliance_obligations
       WHERE created_at < $2
         AND (
           created_at >= $1
           OR due_date >= $1
           OR status <> 'Compliant'
         )
       ORDER BY COALESCE(due_date, created_at) ASC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, title, status, start_date, end_date, created_at
       FROM audits
       WHERE created_at < $2
         AND (
           start_date >= $1
           OR end_date >= $1
           OR status IN ('Planned', 'In Progress')
         )
       ORDER BY start_date DESC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, title, status, due_date, effective_date, created_at
       FROM legal_updates
       WHERE created_at < $2
         AND (
           effective_date >= $1
           OR due_date >= $1
           OR status IN ('New', 'Under Review', 'Action Required', 'Implemented')
         )
       ORDER BY COALESCE(due_date, effective_date, created_at) DESC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, status, monitored_date
       FROM emissions
       WHERE monitored_date >= $1 AND monitored_date < $2
       ORDER BY monitored_date DESC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, severity, date, cleanup_completed, reported_to_nema
       FROM spills
       WHERE date >= $1::date AND date < $2::date
       ORDER BY date DESC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
    pgPool.query(
      `SELECT id, next_due_date, fitness_for_work, type, examination_date
       FROM health_surveillance
       WHERE examination_date < $2
         AND (
           examination_date >= $1
           OR next_due_date >= $1
           OR fitness_for_work = FALSE
         )
       ORDER BY next_due_date ASC
       LIMIT 2000`,
      [trendStart.toISOString(), next.toISOString()],
    ),
  ]);

  const allIncidents = incidentResult.rows.map((row) => asIncident(row as Record<string, unknown>));
  const incidents = allIncidents.filter((item) => item.date >= start.toISOString() && item.date < next.toISOString());

  const trendMap = new Map(
    monthKeys.map((key) => [key, { month: toMonthLabel(key), incidents: 0, closed: 0, open: 0 }]),
  );
  for (const incident of allIncidents) {
    const key = toMonthKey(incident.date);
    const bucket = trendMap.get(key);
    if (!bucket) continue;
    bucket.incidents += 1;
    if (incident.status === "Closed") bucket.closed += 1;
    else bucket.open += 1;
  }
  const trendData = monthKeys.map((key) => trendMap.get(key)!);

  const incidentTypesMap = new Map<string, number>();
  const departmentMap = new Map<string, number>();
  const siteMap = new Map<string, { count: number; maxSeverity: number }>();
  let criticalOpen = 0;
  let openReports = 0;
  let closedReports = 0;

  for (const incident of incidents) {
    incidentTypesMap.set(incident.type, (incidentTypesMap.get(incident.type) ?? 0) + 1);
    departmentMap.set(incident.department, (departmentMap.get(incident.department) ?? 0) + 1);
    const currentSite = siteMap.get(incident.site) ?? { count: 0, maxSeverity: 0 };
    currentSite.count += 1;
    currentSite.maxSeverity = Math.max(currentSite.maxSeverity, rankSeverity(incident.severity));
    siteMap.set(incident.site, currentSite);
    if (incident.status === "Closed") closedReports += 1;
    else openReports += 1;
    if (incident.severity === "Critical" && incident.status !== "Closed") criticalOpen += 1;
  }

  const incidentTypes = Array.from(incidentTypesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
  const departmentPerformance = Array.from(departmentMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);

  const sites = Array.from(siteMap.entries())
    .map(([name, data]) => {
      const riskScore: SitePerformance["riskScore"] =
        data.maxSeverity >= 4 || data.count > 10
          ? "High"
          : data.maxSeverity >= 3 || data.count > 5
            ? "Medium"
            : "Low";
      const trend: SitePerformance["trend"] =
        data.maxSeverity >= 4 || data.count > 10
          ? "Needs attention"
          : data.maxSeverity >= 3 || data.count > 5
            ? "Watch"
            : "Stable";
      return {
        name,
        incidents: data.count,
        riskScore,
        trend,
      };
    })
    .sort((left, right) => right.incidents - left.incidents);

  const selectedCapas = capaResult.rows
    .map((row) => {
      const dueDate = toIso(row.due_date ?? row.completed_date ?? row.created_at);
      const status = String(row.status ?? "Open");
      const dueBeforeMonthEnd = dueDate < next.toISOString();
      const relevant =
        dueBeforeMonthEnd ||
        (row.completed_date && toIso(row.completed_date) >= start.toISOString() && toIso(row.completed_date) < next.toISOString());
      if (!relevant) return null;
      return {
        id: String(row.id),
        title: String(row.title ?? "CAPA"),
        owner: String(row.owner ?? "Unassigned"),
        dueDate,
        status: status === "Completed" ? "Closed" : "Open",
        severity: String(row.priority ?? "Medium") as CapaItem["severity"],
      } satisfies CapaItem;
    })
    .filter((item): item is CapaItem => item !== null)
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "Open" ? -1 : 1;
      return rankSeverity(right.severity) - rankSeverity(left.severity);
    })
    .slice(0, 10);

  const capaTrendMap = new Map(
    monthKeys.map((key) => [key, { month: toMonthLabel(key), opened: 0, closed: 0, overdue: 0 }]),
  );
  let overdueCapas = 0;
  for (const row of capaResult.rows) {
    const createdAt = toIso(row.created_at);
    const completedAt = row.completed_date ? toIso(row.completed_date) : null;
    const dueDate = row.due_date ? toIso(row.due_date) : null;
    const status = String(row.status ?? "Open");

    const createdBucket = capaTrendMap.get(toMonthKey(createdAt));
    if (createdBucket) createdBucket.opened += 1;

    if (completedAt) {
      const closedBucket = capaTrendMap.get(toMonthKey(completedAt));
      if (closedBucket) closedBucket.closed += 1;
    }

    if (dueDate && dueDate < next.toISOString() && status !== "Completed" && status !== "Cancelled") {
      overdueCapas += 1;
      const overdueBucket = capaTrendMap.get(toMonthKey(dueDate));
      if (overdueBucket) overdueBucket.overdue += 1;
    }
  }
  const capaTrendData = monthKeys.map((key) => capaTrendMap.get(key)!);

  const trainingGroups = new Map<
    string,
    { name: string; department: string; total: number; completed: number; expiryDate: string; hasExpired: boolean }
  >();
  const monthEndPlus30 = new Date(next);
  monthEndPlus30.setUTCDate(monthEndPlus30.getUTCDate() + 30);
  let expiringTraining = 0;

  for (const row of trainingResult.rows) {
    const name = String(row.course_title ?? "Training");
    const department = String(row.department ?? "Unspecified");
    const key = `${name}::${department}`;
    const expiryDate = toIso(row.expiry_date ?? row.completed_date ?? row.scheduled_date);
    const status = String(row.status ?? "Scheduled");
    const existing = trainingGroups.get(key) ?? {
      name,
      department,
      total: 0,
      completed: 0,
      expiryDate,
      hasExpired: false,
    };
    existing.total += 1;
    if (status === "Completed") existing.completed += 1;
    if (expiryDate < monthEndPlus30.toISOString()) existing.expiryDate = expiryDate;
    if (status === "Expired" || expiryDate < next.toISOString()) existing.hasExpired = true;
    trainingGroups.set(key, existing);
  }

  const training = Array.from(trainingGroups.values())
    .map((group) => {
      const completion = group.total ? Math.round((group.completed / group.total) * 100) : 0;
      const status =
        group.hasExpired
          ? "Expired"
          : group.expiryDate < monthEndPlus30.toISOString()
            ? "Expiring soon"
            : "On track";
      if (status !== "On track") expiringTraining += 1;
      return {
        name: group.name,
        department: group.department,
        completion,
        expiryDate: group.expiryDate.slice(0, 10),
        status,
      } satisfies TrainingItem;
    })
    .sort((left, right) => {
      const order = { Expired: 0, "Expiring soon": 1, "On track": 2 } as const;
      return order[left.status] - order[right.status] || left.completion - right.completion;
    })
    .slice(0, 8);

  const totalTraining = Array.from(trainingGroups.values()).reduce((sum, group) => sum + group.total, 0);
  const totalTrainingCompleted = Array.from(trainingGroups.values()).reduce(
    (sum, group) => sum + group.completed,
    0,
  );
  const trainingCompletion = totalTraining ? Math.round((totalTrainingCompleted / totalTraining) * 100) : 0;
  const monthEndPlus30Iso = monthEndPlus30.toISOString();

  const openComplianceStatuses = new Set(["Pending", "Non-Compliant"]);
  const activeLegalStatuses = new Set(["New", "Under Review", "Action Required"]);
  const activeAuditStatuses = new Set(["Planned", "In Progress"]);

  let overdueObligations = 0;
  let nonCompliantObligations = 0;
  for (const row of complianceResult.rows) {
    const status = String(row.status ?? "Pending");
    const dueDate = row.due_date ? toIso(row.due_date) : null;
    if (status === "Non-Compliant") nonCompliantObligations += 1;
    if (openComplianceStatuses.has(status) && dueDate && dueDate < next.toISOString()) {
      overdueObligations += 1;
    }
  }

  let openAudits = 0;
  for (const row of auditResult.rows) {
    const status = String(row.status ?? "Planned");
    if (activeAuditStatuses.has(status)) openAudits += 1;
  }

  let legalActionsDue = 0;
  for (const row of legalUpdateResult.rows) {
    const status = String(row.status ?? "New");
    const dueDate = row.due_date ? toIso(row.due_date) : row.effective_date ? toIso(row.effective_date) : null;
    if (activeLegalStatuses.has(status) && dueDate && dueDate < monthEndPlus30Iso) {
      legalActionsDue += 1;
    }
  }

  const currentMonthEmissions = emissionResult.rows.filter((row) => {
    const monitoredDate = toIso(row.monitored_date);
    return monitoredDate >= start.toISOString() && monitoredDate < next.toISOString();
  });
  const emissionExceedances = currentMonthEmissions.filter(
    (row) => String(row.status ?? "Within Limit") !== "Within Limit",
  ).length;

  const currentMonthSpills = spillResult.rows.filter((row) => {
    const spillDate = toIso(row.date);
    return spillDate >= start.toISOString() && spillDate < next.toISOString();
  });
  const majorSpills = currentMonthSpills.filter((row) =>
    ["Major", "Critical"].includes(String(row.severity ?? "Minor")),
  ).length;
  const unclosedSpills = currentMonthSpills.filter((row) => !row.cleanup_completed).length;

  let healthDueSoon = 0;
  let healthRestrictions = 0;
  for (const row of healthResult.rows) {
    const nextDueDate = toIso(row.next_due_date);
    if (nextDueDate < monthEndPlus30Iso) healthDueSoon += 1;
    if (!row.fitness_for_work) healthRestrictions += 1;
  }

  const complianceAttention = overdueObligations + nonCompliantObligations + legalActionsDue;
  const environmentalAttention = emissionExceedances + majorSpills + unclosedSpills;
  const healthAttention = healthDueSoon + healthRestrictions;

  const notifications: MonthlyEhsReportPayload["model"]["notifications"] = [];
  if (criticalOpen > 0) {
    notifications.push({
      title: `${criticalOpen} critical report${criticalOpen === 1 ? "" : "s"} open`,
      detail: "Immediate management follow-up is required.",
      href: "#incident-table",
    });
  }
  if (overdueCapas > 0) {
    notifications.push({
      title: `${overdueCapas} overdue CAPA${overdueCapas === 1 ? "" : "s"}`,
      detail: "Close high-risk actions before the next review cycle.",
      href: "#capa",
    });
  }
  if (expiringTraining > 0) {
    notifications.push({
      title: `${expiringTraining} training item${expiringTraining === 1 ? "" : "s"} expiring or expired`,
      detail: "Plan refresh sessions for critical competency coverage.",
      href: "#training",
    });
  }
  if (complianceAttention > 0 || openAudits > 0) {
    notifications.push({
      title: `${complianceAttention + openAudits} compliance item${complianceAttention + openAudits === 1 ? "" : "s"} need review`,
      detail: "Overdue obligations, legal actions, or open audits should be escalated.",
      href: "#summary",
    });
  }
  if (environmentalAttention > 0) {
    notifications.push({
      title: `${environmentalAttention} environmental alert${environmentalAttention === 1 ? "" : "s"} in scope`,
      detail: "Review exceedances, major spills, and incomplete cleanup actions.",
      href: "#summary",
    });
  }
  if (healthAttention > 0) {
    notifications.push({
      title: `${healthAttention} occupational health item${healthAttention === 1 ? "" : "s"} due`,
      detail: "Follow up on surveillance due dates and restricted-fit cases.",
      href: "#summary",
    });
  }
  if (!notifications.length) {
    notifications.push({
      title: "No critical monthly escalations",
      detail: "Current month indicators are within expected operating range.",
      href: "#summary",
    });
  }

  const currentFocus =
    criticalOpen > 0
      ? "Close critical open incidents and verify overdue corrective actions before month end."
      : overdueCapas > 0
        ? "Reduce overdue CAPAs and confirm owners for the oldest open actions."
        : expiringTraining > 0
          ? "Renew expiring training and protect coverage for high-risk tasks."
          : complianceAttention + openAudits > 0
            ? "Close overdue compliance actions and keep planned audits moving to completion."
            : environmentalAttention > 0
              ? "Resolve environmental exceedances and verify spill cleanup evidence before review."
              : healthAttention > 0
                ? "Refresh due health surveillance and review fit-for-work restrictions with line leaders."
                : "Maintain close-out discipline and keep proactive reporting momentum up across sites.";

  const metrics: MetricCard[] = [
    {
      key: "incidents",
      label: "Total Reports",
      value: String(incidents.length),
      change: "Live",
      direction: "flat",
      sparkline: trendData.map((item) => item.incidents).slice(-6),
      description: "Production incident reports logged in the selected month",
    },
    {
      key: "open",
      label: "Open Reports",
      value: String(openReports),
      change: openReports > closedReports ? "Watch" : "Stable",
      direction: openReports > closedReports ? "up" : "flat",
      sparkline: trendData.map((item) => item.open).slice(-6),
      description: "Incident reports that remain open or in progress",
    },
    {
      key: "closed",
      label: "Closed Reports",
      value: String(closedReports),
      change: "Live",
      direction: "flat",
      sparkline: trendData.map((item) => item.closed).slice(-6),
      description: "Incident reports closed in the selected month",
    },
    {
      key: "critical",
      label: "Critical Open",
      value: String(criticalOpen),
      change: criticalOpen > 0 ? "Action required" : "On track",
      direction: criticalOpen > 0 ? "up" : "flat",
      sparkline: trendData.map((item) => item.open).slice(-6),
      description: "Critical-severity incident reports still awaiting closure",
    },
    {
      key: "capa",
      label: "CAPAs Closed vs Opened",
      value: `${capaTrendData[capaTrendData.length - 1]?.closed ?? 0} / ${capaTrendData[capaTrendData.length - 1]?.opened ?? 0}`,
      change: overdueCapas > 0 ? "Follow-up" : "Healthy",
      direction: overdueCapas > 0 ? "down" : "up",
      sparkline: capaTrendData.map((item) => item.closed).slice(-6),
      description: "Corrective actions closed versus opened in the current month",
    },
    {
      key: "training",
      label: "Training Completion %",
      value: `${trainingCompletion}%`,
      change: expiringTraining > 0 ? "Renewals due" : "On track",
      direction: expiringTraining > 0 ? "down" : "up",
      sparkline: [trainingCompletion],
      description: "Completion rate across monthly training records in scope",
    },
    {
      key: "compliance",
      label: "Compliance Attention",
      value: `${complianceAttention} / ${openAudits}`,
      change: complianceAttention + openAudits > 0 ? "Escalate" : "Controlled",
      direction: complianceAttention + openAudits > 0 ? "down" : "up",
      sparkline: [overdueObligations, nonCompliantObligations, legalActionsDue, openAudits],
      description: "Overdue obligations and legal actions versus open audits",
    },
    {
      key: "environmental",
      label: "Environmental Alerts",
      value: `${emissionExceedances} / ${majorSpills}`,
      change: environmentalAttention > 0 ? "Investigate" : "Within range",
      direction: environmentalAttention > 0 ? "down" : "up",
      sparkline: [emissionExceedances, majorSpills, unclosedSpills],
      description: "Current-month emission exceedances versus major spills",
    },
    {
      key: "health",
      label: "Health Due / Restricted",
      value: `${healthDueSoon} / ${healthRestrictions}`,
      change: healthAttention > 0 ? "Follow-up" : "Covered",
      direction: healthAttention > 0 ? "down" : "up",
      sparkline: [healthDueSoon, healthRestrictions],
      description: "Upcoming health surveillance due dates and restricted-fit cases",
    },
  ];

  const summaryText = incidents.length
    ? `${incidents.length} live incident reports were recorded for ${monthKey}. ${closedReports} are closed, ${openReports} remain open or in progress, ${selectedCapas.filter((item) => item.status === "Open").length} CAPAs still require follow-up, training completion is ${trainingCompletion}%, compliance attention items total ${complianceAttention} with ${openAudits} open audits, environmental alerts include ${emissionExceedances} emission exceedance${emissionExceedances === 1 ? "" : "s"} and ${majorSpills} major spill${majorSpills === 1 ? "" : "s"}, and occupational health follow-up covers ${healthDueSoon} due surveillance record${healthDueSoon === 1 ? "" : "s"} plus ${healthRestrictions} restricted-fit case${healthRestrictions === 1 ? "" : "s"}.`
    : `No incident reports were recorded for ${monthKey}. CAPA, training, compliance, environmental, and health controls are still shown from live system data where available.`;

  return {
    month: monthKey,
    currentFocus,
    model: {
      metrics,
      trendData,
      capaTrendData,
      incidentTypes,
      departmentPerformance,
      incidents,
      capas: selectedCapas,
      training,
      sites,
      notifications,
      summaryText,
    },
  };
}
