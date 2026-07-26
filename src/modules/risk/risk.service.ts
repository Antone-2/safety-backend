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
    return this.repository.getRegisters(filters);
  }

  async getRegisterById(id: string): Promise<RiskRegister | null> {
    return this.repository.getRegisterById(id);
  }

  async createRegister(data: CreateRiskRegisterInput): Promise<RiskRegister> {
    const riskRating = data.likelihood * data.severity;
    const riskLevel = this.calculateRiskLevel(riskRating);
    return this.repository.createRegister({ ...data, riskRating, riskLevel });
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
    return this.repository.updateRegister(id, updateData);
  }

  async getBowTies(): Promise<BowTie[]> {
    return this.repository.getBowTies();
  }

  async createBowTie(data: CreateBowTieInput): Promise<BowTie> {
    return this.repository.createBowTie(data);
  }

  async getRiskDashboard(): Promise<RiskDashboard> {
    return this.repository.getRiskDashboard();
  }
}
