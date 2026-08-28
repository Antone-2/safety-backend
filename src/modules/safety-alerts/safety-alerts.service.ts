import { NotFoundError } from "../../shared/domain/errors/index.js";
import { SafetyAlertsRepository } from "./safety-alerts.repository.js";
import type {
  AcknowledgeSafetyAlertInput,
  CreateSafetyAlertInput,
  UpdateSafetyAlertInput,
} from "./safety-alerts.types.js";

export class SafetyAlertsService {
  constructor(private repository: SafetyAlertsRepository) {}

  getAlerts(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }

  create(data: CreateSafetyAlertInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateSafetyAlertInput) {
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError("Safety alert");
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError("Safety alert");
    return deleted;
  }

  acknowledge(alertId: string, input: AcknowledgeSafetyAlertInput) {
    return this.repository.acknowledge(alertId, input);
  }

  getAcknowledgements(alertId: string) {
    return this.repository.getAcknowledgements(alertId);
  }

  getPendingAcknowledgements(userId: string) {
    return this.repository.getPendingAcknowledgements(userId);
  }

  getStats() {
    return this.repository.getStats();
  }
}
