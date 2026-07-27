import {
  Equipment,
  EquipmentInspection,
  CreateEquipmentInput,
  UpdateEquipmentInput,
  CreateEquipmentInspectionInput,
  UpdateEquipmentInspectionInput,
  EquipmentStats,
} from "./equipment.types.js";
import { EquipmentRepository } from "./equipment.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class EquipmentService {
  constructor(private repository: EquipmentRepository) {}

  async getEquipment(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getEquipmentById(id: string) {
    return this.repository.findById(id);
  }

  async createEquipment(data: CreateEquipmentInput) {
    return this.repository.create(data);
  }

  async updateEquipment(id: string, data: UpdateEquipmentInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("Equipment");
    return this.repository.update(id, data);
  }

  async deleteEquipment(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) return false;
    return this.repository.delete(id);
  }

  async getInspections(filters?: Record<string, unknown>) {
    return this.repository.findInspections(filters);
  }

  async createInspection(data: CreateEquipmentInspectionInput) {
    return this.repository.createInspection(data);
  }

  async getInspectionById(id: string) {
    return this.repository.findInspectionById(id);
  }

  async updateInspection(id: string, data: UpdateEquipmentInspectionInput) {
    const existing = await this.repository.findInspectionById(id);
    if (!existing) throw new NotFoundError("Equipment inspection");
    return this.repository.updateInspection(id, data);
  }

  async deleteInspection(id: string) {
    const existing = await this.repository.findInspectionById(id);
    if (!existing) return false;
    return this.repository.deleteInspection(id);
  }

  async getOverdueInspections() {
    const nowIso = new Date().toISOString();
    const all = await this.repository.findAll({ status: "Operational" });
    return all.filter((item) => item.nextInspectionDate && item.nextInspectionDate < nowIso);
  }

  async getEquipmentStats(): Promise<EquipmentStats> {
    return this.repository.getStats();
  }
}
