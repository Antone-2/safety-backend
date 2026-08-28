import { BusinessRuleError, NotFoundError } from "../../shared/domain/errors/index.js";
import { tryParseReportDateWithFallbacks } from "../../shared/utils/report-date.js";
const now = () => new Date().toISOString();
function parseJsonArray(value) {
    if (Array.isArray(value))
        return value.map(String).filter(Boolean);
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    }
    catch {
        return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
}
function normalizeIncidentStatus(value) {
    const status = String(value ?? "Open").trim();
    if (status === "In Progress")
        return "Investigating";
    if (status === "Open")
        return "Open";
    if (status === "Investigating")
        return "Investigating";
    if (status === "Root Cause Analysis")
        return "Root Cause Analysis";
    if (status === "CAPA Open")
        return "CAPA Open";
    if (status === "Closed")
        return "Closed";
    return "Open";
}
function normalizeIncidentSeverity(value) {
    const severity = String(value ?? "Medium").trim();
    if (severity === "Low")
        return "Low";
    if (severity === "Medium")
        return "Medium";
    if (severity === "High")
        return "High";
    if (severity === "Critical")
        return "Critical";
    return "Medium";
}
function normalizeFilterValue(value) {
    if (value === undefined || value === null)
        return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized.toLowerCase() : undefined;
}
function normalizeBoolean(value) {
    if (typeof value === "boolean")
        return value;
    return ["true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}
function normalizeDatabaseIncident(row) {
    const value = row;
    const createdAt = String(value.createdAt ?? value.created_at ?? now());
    const updatedAt = String(value.updatedAt ?? value.updated_at ?? createdAt);
    return {
        id: String(value.id),
        type: value.type,
        severity: normalizeIncidentSeverity(value.severity),
        status: normalizeIncidentStatus(value.status),
        location: String(value.location ?? ""),
        department: String(value.department ?? ""),
        shift: String(value.shift ?? ""),
        description: String(value.description ?? ""),
        reporter: String(value.reporter ?? ""),
        reporterEmail: value.reporterEmail ?? value.reporter_email ? String(value.reporterEmail ?? value.reporter_email) : undefined,
        reporterPhone: value.reporterPhone ?? value.reporter_phone ? String(value.reporterPhone ?? value.reporter_phone) : undefined,
        anonymous: normalizeBoolean(value.anonymous),
        isNearMiss: normalizeBoolean(value.isNearMiss ?? value.is_near_miss),
        photoUrl: value.photoUrl ?? value.photo_url ? String(value.photoUrl ?? value.photo_url) : undefined,
        photos: parseJsonArray(value.photos),
        assignedTo: value.assignedTo ?? value.assigned_to ? String(value.assignedTo ?? value.assigned_to) : undefined,
        assignedToCopy: parseJsonArray(value.assignedToCopy ?? value.assigned_to_copy),
        slaHours: Number(value.slaHours ?? value.sla_hours ?? 24),
        dueAt: value.dueAt ?? value.due_at ? String(value.dueAt ?? value.due_at) : undefined,
        resolutionDays: value.resolutionDays ?? value.resolution_days ? Number(value.resolutionDays ?? value.resolution_days) : undefined,
        rootCause: value.rootCause ?? value.root_cause ? String(value.rootCause ?? value.root_cause) : undefined,
        correctiveAction: value.correctiveAction ?? value.corrective_action ? String(value.correctiveAction ?? value.corrective_action) : undefined,
        preventiveAction: value.preventiveAction ?? value.preventive_action ? String(value.preventiveAction ?? value.preventive_action) : undefined,
        investigationMethod: value.investigationMethod ?? value.investigation_method ? String(value.investigationMethod ?? value.investigation_method) : undefined,
        witnessStatement: value.witnessStatement ?? value.witness_statement ? String(value.witnessStatement ?? value.witness_statement) : undefined,
        regulatoryNotificationRequired: normalizeBoolean(value.regulatoryNotificationRequired ?? value.regulatory_notification_required),
        regulatoryNotificationDate: value.regulatoryNotificationDate ?? value.regulatory_notification_date ? String(value.regulatoryNotificationDate ?? value.regulatory_notification_date) : undefined,
        complianceRequired: normalizeBoolean(value.complianceRequired ?? value.compliance_required),
        complianceDueAt: value.complianceDueAt ?? value.compliance_due_at ? String(value.complianceDueAt ?? value.compliance_due_at) : undefined,
        source: String(value.source ?? "manual"),
        createdAt,
        updatedAt,
    };
}
function matchesIncidentFilters(incident, filters) {
    if (!filters)
        return true;
    const status = normalizeFilterValue(filters.status);
    if (status && incident.status.toLowerCase() !== status)
        return false;
    const severity = normalizeFilterValue(filters.severity);
    if (severity && incident.severity.toLowerCase() !== severity)
        return false;
    const location = normalizeFilterValue(filters.location);
    if (location && !incident.location.toLowerCase().includes(location))
        return false;
    const department = normalizeFilterValue(filters.department);
    if (department && !incident.department.toLowerCase().includes(department))
        return false;
    return true;
}
function mapReportToIncident(row) {
    const reportType = String(row.type ?? "").toLowerCase();
    const createdAt = tryParseReportDateWithFallbacks(row.created_at, row.updated_at) ?? now();
    const updatedAt = tryParseReportDateWithFallbacks(row.updated_at, row.created_at) ?? createdAt;
    const dueAt = tryParseReportDateWithFallbacks(row.due_at, createdAt, updatedAt);
    const complianceDueAt = row.compliance_due_at
        ? tryParseReportDateWithFallbacks(row.compliance_due_at, dueAt, createdAt, updatedAt)
        : undefined;
    // Map report type to incident type
    const typeMap = {
        "unsafe act": "Unsafe Act",
        "unsafe condition": "Unsafe Condition",
        "near miss": "Near Miss",
        "first aid": "First Aid",
        "medical treatment": "Medical Treatment",
        "lost time": "Lost Time",
        "fatality": "Fatality",
        "property damage": "Property Damage",
        "environmental": "Environmental",
    };
    const mappedType = typeMap[reportType] ?? "Unsafe Condition";
    return {
        id: String(row.id),
        type: mappedType,
        severity: normalizeIncidentSeverity(row.severity),
        status: normalizeIncidentStatus(row.status),
        location: String(row.location ?? ""),
        department: String(row.department ?? ""),
        shift: String(row.shift ?? ""),
        description: String(row.description ?? ""),
        reporter: String(row.reporter ?? ""),
        reporterEmail: row.reporter_email ? String(row.reporter_email) : undefined,
        reporterPhone: row.reporter_phone ? String(row.reporter_phone) : undefined,
        anonymous: Boolean(row.anonymous),
        isNearMiss: Boolean(row.is_near_miss),
        photoUrl: String(row.photo_url ?? ""),
        photos: [],
        assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
        assignedToCopy: parseJsonArray(row.assigned_to_copy),
        slaHours: Number(row.sla_hours ?? 24),
        dueAt,
        resolutionDays: row.resolution_days ? Number(row.resolution_days) : undefined,
        rootCause: undefined,
        correctiveAction: undefined,
        preventiveAction: undefined,
        investigationMethod: undefined,
        witnessStatement: undefined,
        regulatoryNotificationRequired: false,
        regulatoryNotificationDate: undefined,
        complianceRequired: Boolean(row.compliance_required),
        complianceDueAt,
        source: String(row.source ?? "manual"),
        sourceKind: "report-sync",
        readonly: true,
        auditHistory: undefined,
        createdAt,
        updatedAt,
    };
}
export class IncidentsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getCombinedIncidents() {
        const [incidents, reports] = await Promise.all([
            this.repository.findAll(),
            this.repository.findAllReports(),
        ]);
        const mappedReports = reports.map(mapReportToIncident);
        const mappedIncidents = incidents.map((incident) => ({
            ...normalizeDatabaseIncident(incident),
            sourceKind: "database",
            readonly: false,
        }));
        const combined = [...mappedIncidents, ...mappedReports];
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const seen = new Set();
        return combined.filter((item) => {
            if (seen.has(item.id))
                return false;
            seen.add(item.id);
            return true;
        });
    }
    async getAll(filters) {
        const combined = await this.getCombinedIncidents();
        return combined.filter((incident) => matchesIncidentFilters(incident, filters));
    }
    async getById(id) {
        const incident = await this.repository.findById(id);
        if (incident) {
            return { ...normalizeDatabaseIncident(incident), sourceKind: "database", readonly: false };
        }
        const report = await this.repository.findReportById(id);
        return report ? mapReportToIncident(report) : null;
    }
    async create(data) {
        if (data.severity === "Critical" && !data.department) {
            throw new BusinessRuleError("Critical incidents require a department");
        }
        const created = await this.repository.create(data);
        return { ...normalizeDatabaseIncident(created), sourceKind: "database", readonly: false };
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Incident");
        const updated = await this.repository.update(id, data);
        return updated ? { ...normalizeDatabaseIncident(updated), sourceKind: "database", readonly: false } : null;
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getStats() {
        const incidents = await this.getCombinedIncidents();
        const nowTime = Date.now();
        return {
            total: incidents.length,
            open: incidents.filter((incident) => incident.status === "Open").length,
            investigating: incidents.filter((incident) => incident.status === "Investigating" || incident.status === "Root Cause Analysis").length,
            capaOpen: incidents.filter((incident) => incident.status === "CAPA Open").length,
            closed: incidents.filter((incident) => incident.status === "Closed").length,
            critical: incidents.filter((incident) => incident.severity === "Critical" && incident.status !== "Closed").length,
            overdue: incidents.filter((incident) => incident.status !== "Closed" && incident.dueAt && new Date(incident.dueAt).getTime() < nowTime).length,
        };
    }
    async getOverdue() {
        const all = await this.getCombinedIncidents();
        const nowTime = Date.now();
        return all.filter((incident) => incident.status !== "Closed" && incident.dueAt && new Date(incident.dueAt).getTime() < nowTime);
    }
}
