import { Ppe, CreatePpeInput, UpdatePpeInput, PpeStats } from "./ppe.types.js";
import { PpeRepository } from "./ppe.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class PpeService {
  constructor(private repository: PpeRepository) {}

  async getAll(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: CreatePpeInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdatePpeInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("PPE record");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getStats(): Promise<PpeStats> {
    return this.repository.getStats();
  }
}
