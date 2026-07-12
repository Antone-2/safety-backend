import { BusinessRuleError, NotFoundError } from "../../shared/domain/errors/index.js";
const now = () => new Date().toISOString();
export class IncidentsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getAll(filters) {
        return this.repository.findAll(filters);
    }
    async getById(id) {
        return this.repository.findById(id);
    }
    async create(data) {
        if (data.severity === "Critical" && !data.department) {
            throw new BusinessRuleError("Critical incidents require a department");
        }
        return this.repository.create(data);
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Incident");
        return this.repository.update(id, data);
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getStats() {
        const total = await this.repository.count();
        const open = await this.repository.count({ status: "Open" });
        const closed = await this.repository.count({ status: "Closed" });
        return { total, open, closed, today: 0, week: 0 };
    }
    async getOverdue() {
        const all = await this.repository.findAll({ status: "Open" });
        return all.filter((incident) => incident.dueAt && new Date(incident.dueAt) < new Date());
    }
}
