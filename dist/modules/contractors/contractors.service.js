import { NotFoundError } from "../../shared/domain/errors/index.js";
export class ContractorsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getContractors(filters) {
        return this.repository.findAll(filters);
    }
    async getContractorById(id) {
        return this.repository.findById(id);
    }
    async createContractor(data) {
        return this.repository.create(data);
    }
    async updateContractor(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Contractor");
        return this.repository.update(id, data);
    }
    async deleteContractor(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async recordIncident(data) {
        const incident = await this.repository.createIncident(data);
        await this.repository.incrementIncidentCount(data.contractorId);
        return incident;
    }
    async getContractorIncidents(contractorId) {
        return this.repository.findIncidents(contractorId);
    }
    async getContractorStats() {
        return this.repository.getStats();
    }
}
