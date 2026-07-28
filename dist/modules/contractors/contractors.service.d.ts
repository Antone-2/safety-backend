import { Contractor, ContractorIncident, CreateContractorInput, UpdateContractorInput, CreateContractorIncidentInput, UpdateContractorIncidentInput, ContractorStats } from "./contractors.types.js";
import { ContractorsRepository } from "./contractors.repository.js";
export declare class ContractorsService {
    private repository;
    constructor(repository: ContractorsRepository);
    getContractors(filters?: Record<string, unknown>): Promise<Contractor[]>;
    getContractorById(id: string): Promise<Contractor | null>;
    createContractor(data: CreateContractorInput): Promise<Contractor>;
    updateContractor(id: string, data: UpdateContractorInput): Promise<Contractor | null>;
    deleteContractor(id: string): Promise<boolean>;
    recordIncident(data: CreateContractorIncidentInput): Promise<ContractorIncident>;
    getContractorIncidents(contractorId: string): Promise<ContractorIncident[]>;
    getIncidentById(id: string): Promise<ContractorIncident | null>;
    updateIncident(id: string, data: UpdateContractorIncidentInput): Promise<ContractorIncident | null>;
    deleteIncident(id: string): Promise<boolean>;
    getContractorStats(): Promise<ContractorStats>;
}
