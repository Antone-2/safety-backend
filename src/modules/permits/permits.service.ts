import { Permit, CreatePermitInput, UpdatePermitInput, PermitStatus } from "./permits.types.js";
import { PermitsRepository } from "./permits.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class PermitsService {
  constructor(private repository: PermitsRepository) {}

  async getPermits(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getPermitById(id: string) {
    return this.repository.findById(id);
  }

  async createPermit(data: CreatePermitInput) {
    return this.repository.create(data, data.createdBy);
  }

  async updatePermit(id: string, data: UpdatePermitInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Permit");
    return this.repository.update(id, data);
  }

  async advanceStatus(id: string, newStatus: PermitStatus) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Permit");
    return this.repository.update(id, { status: newStatus });
  }

  async getActivePermits() {
    return this.repository.findAll({ status: "active" });
  }

  async getExpiredPermits() {
    const all = await this.repository.findAll({ status: "active" });
    const nowIso = new Date().toISOString();
    return all.filter((permit) => permit.endDate < nowIso);
  }

  async addComment(id: string, comment: { author: string; at: string; text: string }) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Permit");
    const comments = [...existing.comments, comment];
    return this.repository.update(id, { comments } as UpdatePermitInput);
  }
}
