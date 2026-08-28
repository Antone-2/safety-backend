import { NotFoundError } from "../../shared/domain/errors/index.js";
import { VisitorsRepository } from "./visitors.repository.js";
import type {
  CreateVisitorInput,
  UpdateVisitorInput,
} from "./visitors.types.js";

export class VisitorsService {
  constructor(private repository: VisitorsRepository) {}

  getVisitors(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }

  create(data: CreateVisitorInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateVisitorInput) {
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError("Visitor record");
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError("Visitor record");
    return deleted;
  }

  getOnSite() {
    return this.repository.findOnSite();
  }

  getOverdueCheckouts() {
    return this.repository.findOverdueCheckouts();
  }

  getStats() {
    return this.repository.getStats();
  }
}
