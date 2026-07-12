import { Incident, IncidentInput } from "./incidents.types.js";
import { IncidentsRepository } from "./incidents.repository.js";
import { BusinessRuleError, NotFoundError } from "../../shared/domain/errors/index.js";

const now = () => new Date().toISOString();

export class IncidentsService {
  constructor(private repository: IncidentsRepository) {}

  async getAll(filters?: Record<string, unknown>): Promise<Incident[]> {
    return this.repository.findAll(filters);
  }

  async getById(id: string): Promise<Incident | null> {
    return this.repository.findById(id);
  }

  async create(data: IncidentInput): Promise<Incident> {
    if (data.severity === "Critical" && !data.department) {
      throw new BusinessRuleError("Critical incidents require a department");
    }
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<IncidentInput>): Promise<Incident | null> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Incident");
    return this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getStats(): Promise<{ total: number; open: number; closed: number; today: number; week: number }> {
    const total = await this.repository.count();
    const open = await this.repository.count({ status: "Open" });
    const closed = await this.repository.count({ status: "Closed" });
    return { total, open, closed, today: 0, week: 0 };
  }

  async getOverdue(): Promise<Incident[]> {
    const all = await this.repository.findAll({ status: "Open" });
    return all.filter((incident) => incident.dueAt && new Date(incident.dueAt) < new Date());
  }
}
