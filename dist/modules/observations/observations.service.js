import { NotFoundError } from "../../shared/domain/errors/index.js";
export class ObservationsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getObservations(filters) {
        return this.repository.findAll(filters);
    }
    async getObservationById(id) {
        return this.repository.findById(id);
    }
    async createObservation(data) {
        return this.repository.create(data);
    }
    async updateObservation(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Observation");
        return this.repository.update(id, data);
    }
    async deleteObservation(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Observation");
        return this.repository.delete(id);
    }
    async getObservationStats() {
        return this.repository.getStats();
    }
}
