export class KpiService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getDefinitions(filters) {
        return this.repository.getDefinitions(filters);
    }
    async getDefinitionById(id) {
        return this.repository.getDefinitionById(id);
    }
    async createDefinition(data) {
        return this.repository.createDefinition(data);
    }
    async updateDefinition(id, data) {
        return this.repository.updateDefinition(id, data);
    }
    async deleteDefinition(id) {
        return this.repository.deleteDefinition(id);
    }
    async getValues(filters) {
        return this.repository.getValues(filters);
    }
    async getValueById(id) {
        return this.repository.getValueById(id);
    }
    async createValue(data) {
        return this.repository.createValue(data);
    }
    async updateValue(id, data) {
        return this.repository.updateValue(id, data);
    }
    async deleteValue(id) {
        return this.repository.deleteValue(id);
    }
    async getDashboard() {
        return this.repository.getDashboard();
    }
}
