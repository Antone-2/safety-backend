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
    async getAll(filters) {
        const [incidents, reports] = await Promise.all([
            this.repository.findAll(filters),
            this.repository.findAllReports(),
        ]);
        const mappedReports = reports.map(mapReportToIncident);
        const combined = [...incidents, ...mappedReports];
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const seen = new Set();
        return combined.filter((item) => {
            if (seen.has(item.id))
                return false;
            seen.add(item.id);
            return true;
        });
    }
    async getById(id) {
        const incident = await this.repository.findById(id);
        if (incident)
            return incident;
        const report = await this.repository.findReportById(id);
        return report ? mapReportToIncident(report) : null;
    }
    async create(data) {
        if (data.severity === "Critical" && !data.department) {
            throw new BusinessRuleError("Critical incidents require a department");
        }
        return this.repository.create(data);
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Incident");
        return this.repository.update(id, data);
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getStats() {
        const total = await this.repository.count();
        const open = await this.repository.count({ status: "Open" });
        const closed = await this.repository.count({ status: "Closed" });
        return { total, open, closed, today: 0, week: 0 };
    }
    async getOverdue() {
        const all = await this.repository.findAll({ status: "Open" });
        return all.filter((incident) => incident.dueAt && new Date(incident.dueAt) < new Date());
    }
}
