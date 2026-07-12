import { NotFoundError } from "../../shared/domain/errors/index.js";
export class EnvironmentalService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getWaste(filters) {
        return this.repository.findWaste(filters);
    }
    async createWaste(data) {
        return this.repository.createWaste(data);
    }
    async updateWaste(id, data) {
        const existing = (await this.repository.findWaste({ id }))[0];
        if (!existing || existing.id !== id)
            throw new NotFoundError("Waste record");
        return this.repository.updateWaste(id, data);
    }
    async getEmissions(filters) {
        return this.repository.findEmissions(filters);
    }
    async createEmission(data) {
        return this.repository.createEmission(data);
    }
    async updateEmission(id, data) {
        const existing = (await this.repository.findEmissions({ id }))[0];
        if (!existing || existing.id !== id)
            throw new NotFoundError("Emission record");
        return this.repository.updateEmission(id, data);
    }
    async getChemicals(filters) {
        return this.repository.findChemicals(filters);
    }
    async createChemical(data) {
        return this.repository.createChemical(data);
    }
    async updateChemical(id, data) {
        const existing = (await this.repository.findChemicals({ id }))[0];
        if (!existing || existing.id !== id)
            throw new NotFoundError("Chemical");
        return this.repository.updateChemical(id, data);
    }
    async getSpills(filters) {
        return this.repository.findSpills(filters);
    }
    async createSpill(data) {
        return this.repository.createSpill(data);
    }
    async updateSpill(id, data) {
        const existing = (await this.repository.findSpills({ id }))[0];
        if (!existing || existing.id !== id)
            throw new NotFoundError("Spill record");
        return this.repository.updateSpill(id, data);
    }
    async getEnvironmentalStats() {
        return this.repository.getStats();
    }
}
