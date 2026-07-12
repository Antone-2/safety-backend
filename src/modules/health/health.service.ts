import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, HealthStats } from "./health.types.js";
import { HealthRepository } from "./health.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class HealthService {
  constructor(private repository: HealthRepository) {}

  async getRecords(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getRecordById(id: string) {
    return this.repository.findById(id);
  }

  async createRecord(data: CreateHealthRecordInput) {
    return this.repository.create(data);
  }

  async updateRecord(id: string, data: UpdateHealthRecordInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Health record");
    return this.repository.update(id, data);
  }

  async deleteRecord(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getExpiringSurveillances(daysBefore: number = 30) {
    return this.repository.findExpiring(daysBefore);
  }

  async getHealthStats(): Promise<HealthStats> {
    return this.repository.getStats();
  }
}
