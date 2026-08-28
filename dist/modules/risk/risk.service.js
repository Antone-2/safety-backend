export class RiskService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    calculateRiskLevel(rating) {
        if (rating <= 5)
            return "Low";
        if (rating <= 12)
            return "Medium";
        if (rating <= 19)
            return "High";
        return "Critical";
    }
    severityScore(value) {
        const normalized = String(value ?? "").trim().toLowerCase();
        if (normalized === "critical")
            return 5;
        if (normalized === "high")
            return 4;
        if (normalized === "medium")
            return 3;
        if (normalized === "low")
            return 2;
        return 3;
    }
    matchesRegisterFilters(register, filters) {
        if (!filters)
            return true;
        if (filters.location && !register.location.toLowerCase().includes(String(filters.location).toLowerCase()))
            return false;
        if (filters.department && !register.department.toLowerCase().includes(String(filters.department).toLowerCase()))
            return false;
        if (filters.status && register.status.toLowerCase() !== String(filters.status).toLowerCase())
            return false;
        return true;
    }
    mapReportToRiskRegister(row) {
        const severity = this.severityScore(row.severity);
        const likelihood = Math.min(5, Math.max(1, severity - 1 || 3));
        const riskRating = likelihood * severity;
        const location = String(row.location ?? "").trim() || "Unknown";
        const department = String(row.department ?? "").trim() || "Unassigned";
        const category = String(row.category ?? "").trim();
        const type = String(row.type ?? "").trim();
        const description = String(row.description ?? "").trim();
        const titleBase = category || type || description || "Reported hazard";
        const title = titleBase.length > 120 ? `${titleBase.slice(0, 117)}...` : titleBase;
        const activity = type || category || description || "Reported observation";
        const hazard = description || category || type || "Reported observation";
        const controls = category || type || description || "Reported observation";
        const createdAt = String(row.created_at ?? new Date().toISOString());
        const updatedAt = String(row.updated_at ?? createdAt);
        return {
            id: `report-risk-${String(row.id)}`,
            title,
            location,
            department,
            activity,
            hazard,
            existingControls: controls,
            likelihood,
            severity,
            riskRating,
            riskLevel: this.calculateRiskLevel(riskRating),
            status: "Live",
            sourceKind: "report-sync",
            createdBy: String(row.reporter ?? row.source ?? "Synced report"),
            createdAt,
            updatedAt,
            readonly: true,
        };
    }
    async getLiveRegisters(filters) {
        const stored = await this.repository.getRegisters(filters);
        if (stored.length > 0) {
            return stored.map((register) => ({
                ...register,
                sourceKind: "database",
                readonly: false,
            }));
        }
        const reports = await this.repository.getRiskReportCandidates();
        return reports
            .map((row) => this.mapReportToRiskRegister(row))
            .filter((register) => this.matchesRegisterFilters(register, filters));
    }
    async getMatrices() {
        return this.repository.getMatrices();
    }
    async getDefaultMatrix() {
        return this.repository.getDefaultMatrix();
    }
    async createMatrix(data) {
        return this.repository.createMatrix(data);
    }
    async getRegisters(filters) {
        return this.getLiveRegisters(filters);
    }
    async getRegisterById(id) {
        const register = await this.repository.getRegisterById(id);
        if (register) {
            return { ...register, sourceKind: "database", readonly: false };
        }
        const reports = await this.repository.getRiskReportCandidates();
        return reports
            .map((row) => this.mapReportToRiskRegister(row))
            .find((candidate) => candidate.id === id) ?? null;
    }
    async createRegister(data) {
        const riskRating = data.likelihood * data.severity;
        const riskLevel = this.calculateRiskLevel(riskRating);
        const created = await this.repository.createRegister({ ...data, riskRating, riskLevel });
        return { ...created, sourceKind: "database", readonly: false };
    }
    async updateRegister(id, data) {
        const updateData = { ...data };
        if (data.likelihood && data.severity) {
            updateData.riskRating = data.likelihood * data.severity;
            updateData.riskLevel = this.calculateRiskLevel(Number(updateData.riskRating));
        }
        if (data.residualLikelihood && data.residualSeverity) {
            updateData.residualRiskRating = data.residualLikelihood * data.residualSeverity;
            updateData.residualRiskLevel = this.calculateRiskLevel(Number(updateData.residualRiskRating));
        }
        const updated = await this.repository.updateRegister(id, updateData);
        return updated ? { ...updated, sourceKind: "database", readonly: false } : null;
    }
    async deleteRegister(id) {
        return this.repository.deleteRegister(id);
    }
    async getBowTies() {
        return this.repository.getBowTies();
    }
    async createBowTie(data) {
        return this.repository.createBowTie(data);
    }
    async getRiskDashboard() {
        const registers = await this.getLiveRegisters();
        return {
            total: registers.length,
            low: registers.filter((register) => register.riskLevel === "Low").length,
            medium: registers.filter((register) => register.riskLevel === "Medium").length,
            high: registers.filter((register) => register.riskLevel === "High").length,
            critical: registers.filter((register) => register.riskLevel === "Critical").length,
        };
    }
}
