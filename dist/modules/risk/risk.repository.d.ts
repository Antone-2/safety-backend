import { Pool } from "pg";
import type { RiskMatrix, RiskRegister, BowTie, CreateRiskMatrixInput, CreateRiskRegisterInput, CreateBowTieInput, RiskDashboard } from "./risk.types.js";
export declare class RiskRepository {
    private pool;
    constructor(pool: Pool);
    getMatrices(): Promise<RiskMatrix[]>;
    getMatrixById(id: string): Promise<RiskMatrix | null>;
    getDefaultMatrix(): Promise<RiskMatrix | null>;
    createMatrix(data: CreateRiskMatrixInput): Promise<RiskMatrix>;
    getRegisters(filters?: Record<string, any>): Promise<RiskRegister[]>;
    getRegisterById(id: string): Promise<RiskRegister | null>;
    createRegister(data: CreateRiskRegisterInput & {
        riskRating: number;
        riskLevel: string;
    }): Promise<RiskRegister>;
    updateRegister(id: string, data: Record<string, unknown>): Promise<RiskRegister | null>;
    getBowTies(): Promise<BowTie[]>;
    createBowTie(data: CreateBowTieInput): Promise<BowTie>;
    getRiskDashboard(): Promise<RiskDashboard>;
}
