import { BusinessRuleError, NotFoundError } from "../../shared/domain/errors/index.js";
const now = () => new Date().toISOString();
function mapReportToIncident(row) {
    const status = String(row.status ?? "Open");
    const mappedStatus = status === "In Progress" ? "Investigating" : status;
    const reportType = String(row.type ?? "").toLowerCase();
    const severity = String(row.severity ?? "Medium");
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
        severity: severity,
        status: mappedStatus,
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
        assignedToCopy: Array.isArray(row.assigned_to_copy) ? row.assigned_to_copy.map(String) : undefined,
        slaHours: Number(row.sla_hours ?? 24),
        dueAt: row.due_at ? new Date(row.due_at).toISOString() : undefined,
        resolutionDays: row.resolution_days ? Number(row.resolution_days) : undefined,
        rootCause: undefined,
        correctiveAction: undefined,
        preventiveAction: undefined,
        investigationMethod: undefined,
        witnessStatement: undefined,
        regulatoryNotificationRequired: false,
        regulatoryNotificationDate: undefined,
        complianceRequired: Boolean(row.compliance_required),
        complianceDueAt: row.compliance_due_at ? new Date(row.compliance_due_at).toISOString() : undefined,
        source: String(row.source ?? "manual"),
        auditHistory: undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : now(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : now(),
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
        return this.repository.findById(id);
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
