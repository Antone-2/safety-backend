import { NotFoundError } from "../../shared/domain/errors/index.js";
import { InspectionsRepository } from "./inspections.repository.js";
import type {
  CreateInspectionInput,
  CreateInspectionTemplateInput,
  UpdateInspectionInput,
  UpdateInspectionTemplateInput,
} from "./inspections.types.js";

export class InspectionsService {
  constructor(private repository: InspectionsRepository) {}

  async getTemplates(filters?: Record<string, unknown>) {
    return this.repository.findTemplates(filters);
  }

  async getTemplateById(id: string) {
    return this.repository.findTemplateById(id);
  }

  async createTemplate(data: CreateInspectionTemplateInput) {
    return this.repository.createTemplate(data);
  }

  async updateTemplate(id: string, data: UpdateInspectionTemplateInput) {
    const existing = await this.repository.findTemplateById(id);
    if (!existing) throw new NotFoundError("Inspection template");
    return this.repository.updateTemplate(id, data);
  }

  async getInspections(filters?: Record<string, unknown>) {
    const inspections = await this.repository.findInspections(filters);
    return inspections.map((inspection) => {
      if (
        inspection.status !== "Completed" &&
        new Date(inspection.dueDate).getTime() < Date.now()
      ) {
        return { ...inspection, status: "Overdue" as const };
      }
      return inspection;
    });
  }

  async getInspectionById(id: string) {
    const inspection = await this.repository.findInspectionById(id);
    if (!inspection) return null;
    if (
      inspection.status !== "Completed" &&
      new Date(inspection.dueDate).getTime() < Date.now()
    ) {
      return { ...inspection, status: "Overdue" as const };
    }
    return inspection;
  }

  async createInspection(data: CreateInspectionInput) {
    const created = await this.repository.createInspection(data);
    if (!created) throw new NotFoundError("Inspection");
    return created;
  }

  async updateInspection(id: string, data: UpdateInspectionInput) {
    const existing = await this.repository.findInspectionById(id);
    if (!existing) throw new NotFoundError("Inspection");
    const updated = await this.repository.updateInspection(id, data);
    if (!updated) throw new NotFoundError("Inspection");
    return updated;
  }

  async deleteInspection(id: string) {
    const existing = await this.repository.findInspectionById(id);
    if (!existing) throw new NotFoundError("Inspection");
    return this.repository.deleteInspection(id);
  }

  async getOverdueInspections() {
    const inspections = await this.repository.findInspections({ status: "Scheduled" });
    return inspections.filter((inspection) => new Date(inspection.dueDate).getTime() < Date.now());
  }

  async getStats() {
    return this.repository.getStats();
  }
}
