import { Pool } from "pg";
import type { RiskMatrix, RiskRegister, BowTie, CreateRiskMatrixInput, CreateRiskRegisterInput, CreateBowTieInput, RiskDashboard } from "./risk.types.js";
export declare class RiskRepository {
    private pool;
    private readonly columnCache;
    constructor(pool: Pool);
    private getTableColumns;
    private resolveColumn;
    private requireColumn;
    private selectReportColumn;
    private getRiskReportsSql;
    getMatrices(): Promise<RiskMatrix[]>;
    getMatrixById(id: string): Promise<RiskMatrix | null>;
    getDefaultMatrix(): Promise<RiskMatrix | null>;
    createMatrix(data: CreateRiskMatrixInput): Promise<RiskMatrix>;
    getRegisters(filters?: Record<string, any>): Promise<RiskRegister[]>;
    getRegisterById(id: string): Promise<RiskRegister | null>;
    deleteRegister(id: string): Promise<boolean>;
    createRegister(data: CreateRiskRegisterInput & {
        riskRating: number;
        riskLevel: string;
    }): Promise<RiskRegister>;
    updateRegister(id: string, data: Record<string, unknown>): Promise<RiskRegister | null>;
    getBowTies(): Promise<BowTie[]>;
    createBowTie(data: CreateBowTieInput): Promise<BowTie>;
    getRiskReportCandidates(): Promise<Record<string, unknown>[]>;
    getRiskDashboard(): Promise<RiskDashboard>;
}
