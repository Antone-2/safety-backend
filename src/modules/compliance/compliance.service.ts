import {
  ComplianceObligation,
  ComplianceAudit,
  LegalUpdate,
  ComplianceDashboard,
  CreateComplianceObligationInput,
  UpdateComplianceObligationInput,
  CreateComplianceAuditInput,
  UpdateComplianceAuditInput,
  CreateLegalUpdateInput,
  UpdateLegalUpdateInput,
} from "./compliance.types.js";
import { ComplianceRepository } from "./compliance.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class ComplianceService {
  constructor(private repository: ComplianceRepository) {}

  async getObligations(filters?: Record<string, unknown>) {
    return this.repository.findObligations(filters);
  }

  async getObligationById(id: string) {
    return this.repository.findObligationById(id);
  }

  async createObligation(data: CreateComplianceObligationInput) {
    return this.repository.createObligation(data);
  }

  async updateObligation(id: string, data: UpdateComplianceObligationInput) {
    const existing = await this.repository.findObligationById(id);
    if (!existing) throw new NotFoundError("Compliance obligation");
    return this.repository.updateObligation(id, data);
  }

  async deleteObligation(id: string) {
    const existing = await this.repository.findObligationById(id);
    if (!existing) return false;
    return this.repository.deleteObligation(id);
  }

  async getAudits(filters?: Record<string, unknown>) {
    return this.repository.findAudits(filters);
  }

  async getAuditById(id: string) {
    return this.repository.findAuditById(id);
  }

  async createAudit(data: CreateComplianceAuditInput) {
    return this.repository.createAudit(data);
  }

  async updateAudit(id: string, data: UpdateComplianceAuditInput) {
    const existing = await this.repository.findAuditById(id);
    if (!existing) throw new NotFoundError("Compliance audit");
    return this.repository.updateAudit(id, data);
  }

  async deleteAudit(id: string) {
    const existing = await this.repository.findAuditById(id);
    if (!existing) return false;
    return this.repository.deleteAudit(id);
  }

  async getLegalUpdates(filters?: Record<string, unknown>) {
    return this.repository.findLegalUpdates(filters);
  }

  async getLegalUpdateById(id: string) {
    return this.repository.findLegalUpdateById(id);
  }

  async createLegalUpdate(data: CreateLegalUpdateInput) {
    return this.repository.createLegalUpdate(data);
  }

  async updateLegalUpdate(id: string, data: UpdateLegalUpdateInput) {
    const existing = await this.repository.findLegalUpdateById(id);
    if (!existing) throw new NotFoundError("Legal update");
    return this.repository.updateLegalUpdate(id, data);
  }

  async deleteLegalUpdate(id: string) {
    const existing = await this.repository.findLegalUpdateById(id);
    if (!existing) return false;
    return this.repository.deleteLegalUpdate(id);
  }

  async getComplianceDashboard(): Promise<ComplianceDashboard> {
    return this.repository.getDashboard();
  }
}
