import { FireEquipment, FireInspection, CreateFireEquipmentInput, UpdateFireEquipmentInput, CreateFireInspectionInput, FireStats } from "./fire.types.js";
import { FireRepository } from "./fire.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class FireService {
  constructor(private repository: FireRepository) {}

  async getEquipment(filters?: Record<string, unknown>) {
    return this.repository.findEquipment(filters);
  }

  async getEquipmentById(id: string) {
    return this.repository.findEquipmentById(id);
  }

  async createEquipment(data: CreateFireEquipmentInput) {
    return this.repository.createEquipment(data);
  }

  async updateEquipment(id: string, data: UpdateFireEquipmentInput) {
    const existing = await this.repository.findEquipmentById(id);
    if (!existing) throw new NotFoundError("Fire equipment");
    return this.repository.updateEquipment(id, data);
  }

  async deleteEquipment(id: string) {
    const existing = await this.repository.findEquipmentById(id);
    if (!existing) return false;
    return this.repository.deleteEquipment(id);
  }

  async getInspections(filters?: Record<string, unknown>) {
    return this.repository.findInspections(filters);
  }

  async createInspection(data: CreateFireInspectionInput) {
    return this.repository.createInspection(data);
  }

  async getOverdueInspections() {
    return this.repository.findOverdue();
  }

  async getFireStats(): Promise<FireStats> {
    return this.repository.getStats();
  }
}
