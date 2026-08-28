import { NotFoundError } from "../../shared/domain/errors/index.js";
import { ObservationsRepository } from "./observations.repository.js";
import type { CreateObservationInput, UpdateObservationInput } from "./observations.types.js";

export class ObservationsService {
  constructor(private repository: ObservationsRepository) {}

  async getObservations(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getObservationById(id: string) {
    return this.repository.findById(id);
  }

  async createObservation(data: CreateObservationInput) {
    return this.repository.create(data);
  }

  async updateObservation(id: string, data: UpdateObservationInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Observation");
    return this.repository.update(id, data);
  }

  async deleteObservation(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Observation");
    return this.repository.delete(id);
  }

  async getObservationStats() {
    return this.repository.getStats();
  }
}
