import { NotFoundError } from "../../shared/domain/errors/index.js";
export class CalibrationsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    getRecords(filters) {
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
            throw new NotFoundError("Calibration record");
        return updated;
    }
    async delete(id) {
        const deleted = await this.repository.delete(id);
        if (!deleted)
            throw new NotFoundError("Calibration record");
        return deleted;
    }
    getOverdue() {
        return this.repository.findOverdue();
    }
    getOutOfTolerance() {
        return this.repository.findOutOfTolerance();
    }
    getStats() {
        return this.repository.getStats();
    }
}
