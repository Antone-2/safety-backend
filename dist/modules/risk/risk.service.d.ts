import { RiskRepository } from "./risk.repository.js";
import type { CreateRiskMatrixInput, CreateRiskRegisterInput, UpdateRiskRegisterInput, CreateBowTieInput, RiskMatrix, RiskRegister, BowTie, RiskDashboard } from "./risk.types.js";
export declare class RiskService {
    private repository;
    constructor(repository: RiskRepository);
    private calculateRiskLevel;
    private severityScore;
    private matchesRegisterFilters;
    private mapReportToRiskRegister;
    private getLiveRegisters;
    getMatrices(): Promise<RiskMatrix[]>;
    getDefaultMatrix(): Promise<RiskMatrix | null>;
    createMatrix(data: CreateRiskMatrixInput): Promise<RiskMatrix>;
    getRegisters(filters?: Record<string, any>): Promise<RiskRegister[]>;
    getRegisterById(id: string): Promise<RiskRegister | null>;
    createRegister(data: CreateRiskRegisterInput): Promise<RiskRegister>;
    updateRegister(id: string, data: UpdateRiskRegisterInput): Promise<RiskRegister | null>;
    deleteRegister(id: string): Promise<boolean>;
    getBowTies(): Promise<BowTie[]>;
    createBowTie(data: CreateBowTieInput): Promise<BowTie>;
    getRiskDashboard(): Promise<RiskDashboard>;
}
