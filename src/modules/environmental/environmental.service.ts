import {
  WasteRecord,
  Emission,
  Chemical,
  Spill,
  CreateWasteInput,
  UpdateWasteInput,
  CreateEmissionInput,
  UpdateEmissionInput,
  CreateChemicalInput,
  UpdateChemicalInput,
  CreateSpillInput,
  UpdateSpillInput,
  EnvironmentalStats,
} from "./environmental.types.js";
import { EnvironmentalRepository } from "./environmental.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class EnvironmentalService {
  constructor(private repository: EnvironmentalRepository) {}

  async getWaste(filters?: Record<string, unknown>) {
    return this.repository.findWaste(filters);
  }

  async createWaste(data: CreateWasteInput) {
    return this.repository.createWaste(data);
  }

  async updateWaste(id: string, data: UpdateWasteInput) {
    const existing = (await this.repository.findWaste({ id }))[0];
    if (!existing || existing.id !== id)
      throw new NotFoundError("Waste record");
    return this.repository.updateWaste(id, data);
  }

  async getEmissions(filters?: Record<string, unknown>) {
    return this.repository.findEmissions(filters);
  }

  async createEmission(data: CreateEmissionInput) {
    return this.repository.createEmission(data);
  }

  async updateEmission(id: string, data: UpdateEmissionInput) {
    const existing = (await this.repository.findEmissions({ id }))[0];
    if (!existing || existing.id !== id)
      throw new NotFoundError("Emission record");
    return this.repository.updateEmission(id, data);
  }

  async getChemicals(filters?: Record<string, unknown>) {
    return this.repository.findChemicals(filters);
  }

  async createChemical(data: CreateChemicalInput) {
    return this.repository.createChemical(data);
  }

  async updateChemical(id: string, data: UpdateChemicalInput) {
    const existing = (await this.repository.findChemicals({ id }))[0];
    if (!existing || existing.id !== id) throw new NotFoundError("Chemical");
    return this.repository.updateChemical(id, data);
  }

  async getSpills(filters?: Record<string, unknown>) {
    return this.repository.findSpills(filters);
  }

  async createSpill(data: CreateSpillInput) {
    return this.repository.createSpill(data);
  }

  async updateSpill(id: string, data: UpdateSpillInput) {
    const existing = (await this.repository.findSpills({ id }))[0];
    if (!existing || existing.id !== id)
      throw new NotFoundError("Spill record");
    return this.repository.updateSpill(id, data);
  }

  async getEnvironmentalStats(): Promise<EnvironmentalStats> {
    return this.repository.getStats();
  }
}
