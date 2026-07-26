export class RiskService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    calculateRiskLevel(rating) {
        if (rating <= 5)
            return "Low";
        if (rating <= 12)
            return "Medium";
        if (rating <= 19)
            return "High";
        return "Critical";
    }
    async getMatrices() {
        return this.repository.getMatrices();
    }
    async getDefaultMatrix() {
        return this.repository.getDefaultMatrix();
    }
    async createMatrix(data) {
        return this.repository.createMatrix(data);
    }
    async getRegisters(filters) {
        return this.repository.getRegisters(filters);
    }
    async getRegisterById(id) {
        return this.repository.getRegisterById(id);
    }
    async createRegister(data) {
        const riskRating = data.likelihood * data.severity;
        const riskLevel = this.calculateRiskLevel(riskRating);
        return this.repository.createRegister({ ...data, riskRating, riskLevel });
    }
    async updateRegister(id, data) {
        const updateData = { ...data };
        if (data.likelihood && data.severity) {
            updateData.riskRating = data.likelihood * data.severity;
            updateData.riskLevel = this.calculateRiskLevel(Number(updateData.riskRating));
        }
        if (data.residualLikelihood && data.residualSeverity) {
            updateData.residualRiskRating = data.residualLikelihood * data.residualSeverity;
            updateData.residualRiskLevel = this.calculateRiskLevel(Number(updateData.residualRiskRating));
        }
        return this.repository.updateRegister(id, updateData);
    }
    async getBowTies() {
        return this.repository.getBowTies();
    }
    async createBowTie(data) {
        return this.repository.createBowTie(data);
    }
    async getRiskDashboard() {
        return this.repository.getRiskDashboard();
    }
}
