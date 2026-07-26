export class WorkplaceRegistrationService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getRegistrations() {
        await this.repository.seedDefaultsIfEmpty();
        return this.repository.findAll();
    }
    async getRegistrationById(id) {
        return this.repository.findById(id);
    }
    async createRegistration(data) {
        return this.repository.create(data);
    }
    async updateRegistration(id, data) {
        return this.repository.update(id, data);
    }
    async deleteRegistration(id) {
        return this.repository.delete(id);
    }
    async getStats() {
        return this.repository.getStats();
    }
}
