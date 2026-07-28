import { Pool } from "pg";
import type { Contractor, ContractorIncident, CreateContractorInput, UpdateContractorInput, CreateContractorIncidentInput, UpdateContractorIncidentInput, ContractorStats } from "./contractors.types.js";
export declare class ContractorsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Contractor[]>;
    findById(id: string): Promise<Contractor | null>;
    create(data: CreateContractorInput): Promise<Contractor>;
    update(id: string, data: UpdateContractorInput): Promise<Contractor | null>;
    delete(id: string): Promise<boolean>;
    createIncident(data: CreateContractorIncidentInput): Promise<ContractorIncident>;
    findIncidentById(id: string): Promise<ContractorIncident | null>;
    findIncidents(contractorId: string): Promise<ContractorIncident[]>;
    updateIncident(id: string, data: UpdateContractorIncidentInput): Promise<ContractorIncident | null>;
    deleteIncident(id: string): Promise<boolean>;
    incrementIncidentCount(contractorId: string): Promise<void>;
    syncIncidentCount(contractorId: string): Promise<void>;
    getStats(): Promise<ContractorStats>;
}
