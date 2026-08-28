import { NotFoundError } from "../../shared/domain/errors/index.js";
export class InspectionsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getTemplates(filters) {
        return this.repository.findTemplates(filters);
    }
    async getTemplateById(id) {
        return this.repository.findTemplateById(id);
    }
    async createTemplate(data) {
        return this.repository.createTemplate(data);
    }
    async updateTemplate(id, data) {
        const existing = await this.repository.findTemplateById(id);
        if (!existing)
            throw new NotFoundError("Inspection template");
        return this.repository.updateTemplate(id, data);
    }
    async getInspections(filters) {
        const inspections = await this.repository.findInspections(filters);
        return inspections.map((inspection) => {
            if (inspection.status !== "Completed" &&
                new Date(inspection.dueDate).getTime() < Date.now()) {
                return { ...inspection, status: "Overdue" };
            }
            return inspection;
        });
    }
    async getInspectionById(id) {
        const inspection = await this.repository.findInspectionById(id);
        if (!inspection)
            return null;
        if (inspection.status !== "Completed" &&
            new Date(inspection.dueDate).getTime() < Date.now()) {
            return { ...inspection, status: "Overdue" };
        }
        return inspection;
    }
    async createInspection(data) {
        const created = await this.repository.createInspection(data);
        if (!created)
            throw new NotFoundError("Inspection");
        return created;
    }
    async updateInspection(id, data) {
        const existing = await this.repository.findInspectionById(id);
        if (!existing)
            throw new NotFoundError("Inspection");
        const updated = await this.repository.updateInspection(id, data);
        if (!updated)
            throw new NotFoundError("Inspection");
        return updated;
    }
    async deleteInspection(id) {
        const existing = await this.repository.findInspectionById(id);
        if (!existing)
            throw new NotFoundError("Inspection");
        return this.repository.deleteInspection(id);
    }
    async getOverdueInspections() {
        const inspections = await this.repository.findInspections({ status: "Scheduled" });
        return inspections.filter((inspection) => new Date(inspection.dueDate).getTime() < Date.now());
    }
    async getStats() {
        return this.repository.getStats();
    }
}
