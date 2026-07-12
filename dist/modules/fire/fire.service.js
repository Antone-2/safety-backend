import { NotFoundError } from "../../shared/domain/errors/index.js";
export class FireService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getEquipment(filters) {
        return this.repository.findEquipment(filters);
    }
    async getEquipmentById(id) {
        return this.repository.findEquipmentById(id);
    }
    async createEquipment(data) {
        return this.repository.createEquipment(data);
    }
    async updateEquipment(id, data) {
        const existing = await this.repository.findEquipmentById(id);
        if (!existing)
            throw new NotFoundError("Fire equipment");
        return this.repository.updateEquipment(id, data);
    }
    async deleteEquipment(id) {
        const existing = await this.repository.findEquipmentById(id);
        if (!existing)
            return false;
        return this.repository.deleteEquipment(id);
    }
    async getInspections(filters) {
        return this.repository.findInspections(filters);
    }
    async createInspection(data) {
        return this.repository.createInspection(data);
    }
    async getOverdueInspections() {
        return this.repository.findOverdue();
    }
    async getFireStats() {
        return this.repository.getStats();
    }
}
