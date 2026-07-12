import { NotFoundError } from "../../shared/domain/errors/index.js";
export class EquipmentService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getEquipment(filters) {
        return this.repository.findAll(filters);
    }
    async getEquipmentById(id) {
        return this.repository.findById(id);
    }
    async createEquipment(data) {
        return this.repository.create(data);
    }
    async updateEquipment(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Equipment");
        return this.repository.update(id, data);
    }
    async deleteEquipment(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getInspections(filters) {
        return this.repository.findInspections(filters);
    }
    async createInspection(data) {
        return this.repository.createInspection(data);
    }
    async getOverdueInspections() {
        const nowIso = new Date().toISOString();
        const all = await this.repository.findAll({ status: "Operational" });
        return all.filter((item) => item.nextInspectionDate && item.nextInspectionDate < nowIso);
    }
    async getEquipmentStats() {
        return this.repository.getStats();
    }
}
