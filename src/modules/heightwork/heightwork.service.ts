import { HeightWork, CreateHeightWorkInput, UpdateHeightWorkInput, HeightWorkStats } from "./heightwork.types.js";
import { HeightWorkRepository } from "./heightwork.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class HeightWorkService {
  constructor(private repository: HeightWorkRepository) {}

  async getAll(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: CreateHeightWorkInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateHeightWorkInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Height work record");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getStats(): Promise<HeightWorkStats> {
    return this.repository.getStats();
  }
}
