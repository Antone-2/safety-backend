import { NotFoundError } from "../../shared/domain/errors/index.js";
export class ExposureMonitoringService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getRecords(filters) {
        return this.repository.findAll(filters);
    }
    async getById(id) {
        return this.repository.findById(id);
    }
    async create(data) {
        return this.repository.create(data);
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Exposure monitoring record");
        return this.repository.update(id, data);
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getExceedances() {
        return this.repository.findExceedances();
    }
    async getOverdueActions(daysBefore = 30) {
        return this.repository.findOverdueActions(daysBefore);
    }
    async getStats() {
        return this.repository.getStats();
    }
}
