import { Scaffold, CreateScaffoldInput, UpdateScaffoldInput, ScaffoldStats } from "./scaffolding.types.js";
import { ScaffoldRepository } from "./scaffolding.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class ScaffoldService {
  constructor(private repository: ScaffoldRepository) {}

  async getAll(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: CreateScaffoldInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateScaffoldInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Scaffold");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getStats(): Promise<ScaffoldStats> {
    return this.repository.getStats();
  }
}
