import { NotFoundError } from "../../shared/domain/errors/index.js";
export class SafetyAlertsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    getAlerts(filters) {
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
            throw new NotFoundError("Safety alert");
        return updated;
    }
    async delete(id) {
        const deleted = await this.repository.delete(id);
        if (!deleted)
            throw new NotFoundError("Safety alert");
        return deleted;
    }
    acknowledge(alertId, input) {
        return this.repository.acknowledge(alertId, input);
    }
    getAcknowledgements(alertId) {
        return this.repository.getAcknowledgements(alertId);
    }
    getPendingAcknowledgements(userId) {
        return this.repository.getPendingAcknowledgements(userId);
    }
    getStats() {
        return this.repository.getStats();
    }
}
