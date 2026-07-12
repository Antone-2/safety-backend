import { BaseService } from "./base.service.js";
import { z } from "zod";

export const RiskMatrixSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  likelihoodScale: z.record(z.number(), z.string()),
  severityScale: z.record(z.number(), z.string()),
  levels: z.array(z.object({
    label: z.string().min(1).max(50),
    minLikelihood: z.number().min(1).max(5),
    maxLikelihood: z.number().min(1).max(5),
    minSeverity: z.number().min(1).max(5),
    maxSeverity: z.number().min(1).max(5),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })),
  isDefault: z.boolean().default(false),
  createdBy: z.string().min(1).max(200),
});

export const RiskRegisterSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  activity: z.string().min(1).max(500),
  hazard: z.string().min(1).max(500),
  existingControls: z.string().min(1).max(2000),
  likelihood: z.number().min(1).max(5),
  severity: z.number().min(1).max(5),
  riskRating: z.number(),
  riskLevel: z.string(),
  additionalControls: z.string().max(2000).optional(),
  residualLikelihood: z.number().min(1).max(5).optional(),
  residualSeverity: z.number().min(1).max(5).optional(),
  residualRiskRating: z.number().optional(),
  residualRiskLevel: z.string().optional(),
  reviewDate: z.string().optional(),
  reviewedBy: z.string().optional(),
  status: z.string().default("Active"),
  createdBy: z.string().min(1).max(200),
});

export const BowTieSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  topEvent: z.string().min(1).max(500),
  threats: z.string().optional(),
  preventiveBarriers: z.string().optional(),
  consequences: z.string().optional(),
  recoveryBarriers: z.string().optional(),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  createdBy: z.string().min(1).max(200),
  status: z.string().default("Active"),
});

export class RiskService {
  private matrixService: BaseService;
  private registerService: BaseService;
  private bowtieService: BaseService;

  constructor() {
    this.matrixService = new BaseService("risk_matrices", RiskMatrixSchema);
    this.registerService = new BaseService("risk_registers", RiskRegisterSchema);
    this.bowtieService = new BaseService("bow_ties", BowTieSchema);
  }

  async createMatrix(data: z.infer<typeof RiskMatrixSchema>) {
    return this.matrixService.create(data);
  }

  async getMatrices() {
    return this.matrixService.getAll();
  }

  async getDefaultMatrix() {
    const matrices = await this.matrixService.getAll({ isDefault: true });
    return matrices[0] || null;
  }

  async createRegister(data: z.infer<typeof RiskRegisterSchema>) {
    const dataWithRating = {
      ...data,
      riskRating: data.likelihood * data.severity,
      riskLevel: this.calculateRiskLevel(data.likelihood * data.severity),
    };
    return this.registerService.create(dataWithRating);
  }

  async getRegisters(filters?: Record<string, any>) {
    return this.registerService.getAll(filters);
  }

  async getRegisterById(id: string) {
    return this.registerService.getById(id);
  }

  async updateRegister(id: string, data: Record<string, any>) {
    if (data.likelihood && data.severity) {
      data.riskRating = data.likelihood * data.severity;
      data.riskLevel = this.calculateRiskLevel(data.riskRating);
    }
    if (data.residualLikelihood && data.residualSeverity) {
      data.residualRiskRating = data.residualLikelihood * data.residualSeverity;
      data.residualRiskLevel = this.calculateRiskLevel(data.residualRiskRating);
    }
    return this.registerService.update(id, data);
  }

  async createBowTie(data: z.infer<typeof BowTieSchema>) {
    return this.bowtieService.create(data);
  }

  async getBowTies() {
    return this.bowtieService.getAll();
  }

  private calculateRiskLevel(rating: number): string {
    if (rating <= 5) return "Low";
    if (rating <= 12) return "Medium";
    if (rating <= 19) return "High";
    return "Critical";
  }

  async getRiskDashboard() {
    const registers = await this.registerService.getAll();
    const total = registers.length;
    const low = registers.filter((r: any) => r.riskLevel === "Low").length;
    const medium = registers.filter((r: any) => r.riskLevel === "Medium").length;
    const high = registers.filter((r: any) => r.riskLevel === "High").length;
    const critical = registers.filter((r: any) => r.riskLevel === "Critical").length;
    return { total, low, medium, high, critical };
  }
}
