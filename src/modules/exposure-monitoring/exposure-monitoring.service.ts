import { NotFoundError } from "../../shared/domain/errors/index.js";
import { ExposureMonitoringRepository } from "./exposure-monitoring.repository.js";
import type {
  CreateExposureMonitoringInput,
  UpdateExposureMonitoringInput,
} from "./exposure-monitoring.types.js";

export class ExposureMonitoringService {
  constructor(private repository: ExposureMonitoringRepository) {}

  async getRecords(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: CreateExposureMonitoringInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateExposureMonitoringInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Exposure monitoring record");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getExceedances() {
    return this.repository.findExceedances();
  }

  async getOverdueActions(daysBefore = 30) {
    return this.repository.findOverdueActions(daysBefore);
  }

  async getStats() {
    return this.repository.getStats();
  }
}
