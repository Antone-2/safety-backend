import { NotFoundError } from "../../shared/domain/errors/index.js";
export class VisitorsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    getVisitors(filters) {
        return this.repository.findAll(filters);
    }
    getById(id) {
        return this.repository.findById(id);
    }
    create(data) {
        return this.repository.create(data);
    }
    async update(id, data) {
        const updated = await this.repository.update(id, data);
        if (!updated)
            throw new NotFoundError("Visitor record");
        return updated;
    }
    async delete(id) {
        const deleted = await this.repository.delete(id);
        if (!deleted)
            throw new NotFoundError("Visitor record");
        return deleted;
    }
    getOnSite() {
        return this.repository.findOnSite();
    }
    getOverdueCheckouts() {
        return this.repository.findOverdueCheckouts();
    }
    getStats() {
        return this.repository.getStats();
    }
}
