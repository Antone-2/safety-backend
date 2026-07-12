import { Sds, CreateSdsInput, UpdateSdsInput, SdsStats } from "./sds.types.js";
import { SdsRepository } from "./sds.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class SdsService {
  constructor(private repository: SdsRepository) {}

  async getAll(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async searchByChemical(name: string) {
    return this.repository.searchByChemical(name);
  }

  async create(data: CreateSdsInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateSdsInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("SDS");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getStats(): Promise<SdsStats> {
    return this.repository.getStats();
  }
}
