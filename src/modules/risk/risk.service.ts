import { RiskRepository } from "./risk.repository.js";
import type {
  CreateRiskMatrixInput,
  CreateRiskRegisterInput,
  UpdateRiskRegisterInput,
  CreateBowTieInput,
  RiskMatrix,
  RiskRegister,
  BowTie,
  RiskDashboard,
} from "./risk.types.js";

export class RiskService {
  constructor(private repository: RiskRepository) {}

  private calculateRiskLevel(rating: number): string {
    if (rating <= 5) return "Low";
    if (rating <= 12) return "Medium";
    if (rating <= 19) return "High";
    return "Critical";
  }

  private severityScore(value: unknown): number {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "critical") return 5;
    if (normalized === "high") return 4;
    if (normalized === "medium") return 3;
    if (normalized === "low") return 2;
    return 3;
  }

  private matchesRegisterFilters(register: RiskRegister, filters?: Record<string, any>): boolean {
    if (!filters) return true;
    if (filters.location && !register.location.toLowerCase().includes(String(filters.location).toLowerCase())) return false;
    if (filters.department && !register.department.toLowerCase().includes(String(filters.department).toLowerCase())) return false;
    if (filters.status && register.status.toLowerCase() !== String(filters.status).toLowerCase()) return false;
    return true;
  }

  private mapReportToRiskRegister(row: Record<string, unknown>): RiskRegister & { readonly: true } {
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
      riskLevel: this.calculateRiskLevel(riskRating) as RiskRegister["riskLevel"],
      status: "Live",
      sourceKind: "report-sync",
      createdBy: String(row.reporter ?? row.source ?? "Synced report"),
      createdAt,
      updatedAt,
      readonly: true,
    };
  }

  private async getLiveRegisters(filters?: Record<string, any>): Promise<RiskRegister[]> {
    const stored = await this.repository.getRegisters(filters);
    if (stored.length > 0) {
      return stored.map((register) => ({
        ...register,
        sourceKind: "database" as const,
        readonly: false,
      }));
    }

    const reports = await this.repository.getRiskReportCandidates();
    return reports
      .map((row) => this.mapReportToRiskRegister(row))
      .filter((register) => this.matchesRegisterFilters(register, filters));
  }

  async getMatrices(): Promise<RiskMatrix[]> {
    return this.repository.getMatrices();
  }

  async getDefaultMatrix(): Promise<RiskMatrix | null> {
    return this.repository.getDefaultMatrix();
  }

  async createMatrix(data: CreateRiskMatrixInput): Promise<RiskMatrix> {
    return this.repository.createMatrix(data);
  }

  async getRegisters(filters?: Record<string, any>): Promise<RiskRegister[]> {
    return this.getLiveRegisters(filters);
  }

  async getRegisterById(id: string): Promise<RiskRegister | null> {
    const register = await this.repository.getRegisterById(id);
    if (register) {
      return { ...register, sourceKind: "database", readonly: false };
    }

    const reports = await this.repository.getRiskReportCandidates();
    return reports
      .map((row) => this.mapReportToRiskRegister(row))
      .find((candidate) => candidate.id === id) ?? null;
  }

  async createRegister(data: CreateRiskRegisterInput): Promise<RiskRegister> {
    const riskRating = data.likelihood * data.severity;
    const riskLevel = this.calculateRiskLevel(riskRating);
    const created = await this.repository.createRegister({ ...data, riskRating, riskLevel });
    return { ...created, sourceKind: "database", readonly: false };
  }

  async updateRegister(id: string, data: UpdateRiskRegisterInput): Promise<RiskRegister | null> {
    const updateData: Record<string, unknown> = { ...data };
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

  async deleteRegister(id: string): Promise<boolean> {
    return this.repository.deleteRegister(id);
  }

  async getBowTies(): Promise<BowTie[]> {
    return this.repository.getBowTies();
  }

  async createBowTie(data: CreateBowTieInput): Promise<BowTie> {
    return this.repository.createBowTie(data);
  }

  async getRiskDashboard(): Promise<RiskDashboard> {
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
