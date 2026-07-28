export class WibaService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getClaims() {
        await this.repository.seedDefaultsIfEmpty();
        return this.repository.findAll();
    }
    async createClaim(data) {
        return this.repository.create(data);
    }
    async updateClaim(id, data) {
        return this.repository.update(id, data);
    }
    async deleteClaim(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return null;
        await this.repository.delete(id);
        return existing;
    }
}
