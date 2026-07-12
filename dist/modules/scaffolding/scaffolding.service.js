import { NotFoundError } from "../../shared/domain/errors/index.js";
export class ScaffoldService {
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
        return this.repository.create(data);
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Scaffold");
        return this.repository.update(id, data);
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async getStats() {
        return this.repository.getStats();
    }
}
