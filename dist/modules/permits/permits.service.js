import { NotFoundError } from "../../shared/domain/errors/index.js";
export class PermitsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getPermits(filters) {
        return this.repository.findAll(filters);
    }
    async getPermitById(id) {
        return this.repository.findById(id);
    }
    async createPermit(data) {
        return this.repository.create(data, data.createdBy);
    }
    async updatePermit(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Permit");
        return this.repository.update(id, data);
    }
    async advanceStatus(id, newStatus) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Permit");
        return this.repository.update(id, { status: newStatus });
    }
    async getActivePermits() {
        return this.repository.findAll({ status: "active" });
    }
    async getExpiredPermits() {
        const all = await this.repository.findAll({ status: "active" });
        const nowIso = new Date().toISOString();
        return all.filter((permit) => permit.endDate < nowIso);
    }
    async addComment(id, comment) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Permit");
        const comments = [...existing.comments, comment];
        return this.repository.update(id, { comments });
    }
}
