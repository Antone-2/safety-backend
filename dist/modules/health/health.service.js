import { NotFoundError } from "../../shared/domain/errors/index.js";
export class HealthService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getRecords(filters) {
        return this.repository.findAll(filters);
    }
    async getRecordById(id) {
        return this.repository.findById(id);
    }
    async createRecord(data) {
        return this.repository.create(data);
    }
    async updateRecord(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Health record");
        return this.repository.update(id, data);
    }
    async deleteRecord(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getExpiringSurveillances(daysBefore = 30) {
        return this.repository.findExpiring(daysBefore);
    }
    async getHealthStats() {
        return this.repository.getStats();
    }
}
