import { NotFoundError } from "../../shared/domain/errors/index.js";
export class ComplianceService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getObligations(filters) {
        return this.repository.findObligations(filters);
    }
    async getObligationById(id) {
        return this.repository.findObligationById(id);
    }
    async createObligation(data) {
        return this.repository.createObligation(data);
    }
    async updateObligation(id, data) {
        const existing = await this.repository.findObligationById(id);
        if (!existing)
            throw new NotFoundError("Compliance obligation");
        return this.repository.updateObligation(id, data);
    }
    async deleteObligation(id) {
        const existing = await this.repository.findObligationById(id);
        if (!existing)
            return false;
        return this.repository.deleteObligation(id);
    }
    async getAudits(filters) {
        return this.repository.findAudits(filters);
    }
    async getAuditById(id) {
        return this.repository.findAuditById(id);
    }
    async createAudit(data) {
        return this.repository.createAudit(data);
    }
    async updateAudit(id, data) {
        const existing = await this.repository.findAuditById(id);
        if (!existing)
            throw new NotFoundError("Compliance audit");
        return this.repository.updateAudit(id, data);
    }
    async deleteAudit(id) {
        const existing = await this.repository.findAuditById(id);
        if (!existing)
            return false;
        return this.repository.deleteAudit(id);
    }
    async getLegalUpdates(filters) {
        return this.repository.findLegalUpdates(filters);
    }
    async getLegalUpdateById(id) {
        return this.repository.findLegalUpdateById(id);
    }
    async createLegalUpdate(data) {
        return this.repository.createLegalUpdate(data);
    }
    async updateLegalUpdate(id, data) {
        const existing = await this.repository.findLegalUpdateById(id);
        if (!existing)
            throw new NotFoundError("Legal update");
        return this.repository.updateLegalUpdate(id, data);
    }
    async deleteLegalUpdate(id) {
        const existing = await this.repository.findLegalUpdateById(id);
        if (!existing)
            return false;
        return this.repository.deleteLegalUpdate(id);
    }
    async getComplianceDashboard() {
        return this.repository.getDashboard();
    }
}
