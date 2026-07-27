import {
  Contractor,
  ContractorIncident,
  CreateContractorInput,
  UpdateContractorInput,
  CreateContractorIncidentInput,
  UpdateContractorIncidentInput,
  ContractorStats,
} from "./contractors.types.js";
import { ContractorsRepository } from "./contractors.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class ContractorsService {
  constructor(private repository: ContractorsRepository) {}

  async getContractors(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getContractorById(id: string) {
    return this.repository.findById(id);
  }

  async createContractor(data: CreateContractorInput) {
    return this.repository.create(data);
  }

  async updateContractor(id: string, data: UpdateContractorInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Contractor");
    return this.repository.update(id, data);
  }

  async deleteContractor(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async recordIncident(data: CreateContractorIncidentInput) {
    const incident = await this.repository.createIncident(data);
    await this.repository.incrementIncidentCount(data.contractorId);
    return incident;
  }

  async getContractorIncidents(contractorId: string) {
    return this.repository.findIncidents(contractorId);
  }

  async getIncidentById(id: string) {
    return this.repository.findIncidentById(id);
  }

  async updateIncident(id: string, data: UpdateContractorIncidentInput) {
    const existing = await this.repository.findIncidentById(id);
    if (!existing) throw new NotFoundError("Contractor incident");
    const incident = await this.repository.updateIncident(id, data);
    if (incident) {
      if (existing.contractorId !== incident.contractorId) {
        await this.repository.syncIncidentCount(existing.contractorId);
      }
      await this.repository.syncIncidentCount(incident.contractorId);
    }
    return incident;
  }

  async deleteIncident(id: string) {
    const existing = await this.repository.findIncidentById(id);
    if (!existing) return false;
    const deleted = await this.repository.deleteIncident(id);
    if (deleted) {
      await this.repository.syncIncidentCount(existing.contractorId);
    }
    return deleted;
  }

  async getContractorStats(): Promise<ContractorStats> {
    return this.repository.getStats();
  }
}
