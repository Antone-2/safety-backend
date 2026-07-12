import { Contractor, ContractorIncident, CreateContractorInput, UpdateContractorInput, CreateContractorIncidentInput, ContractorStats } from "./contractors.types.js";
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
    getContractorStats(): Promise<ContractorStats>;
}
