import { Pool } from "pg";
import type { Equipment, EquipmentInspection, CreateEquipmentInput, UpdateEquipmentInput, CreateEquipmentInspectionInput, EquipmentStats } from "./equipment.types.js";
export declare class EquipmentRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Equipment[]>;
    findById(id: string): Promise<Equipment | null>;
    create(data: CreateEquipmentInput): Promise<Equipment>;
    update(id: string, data: UpdateEquipmentInput): Promise<Equipment | null>;
    delete(id: string): Promise<boolean>;
    findInspections(filters?: Record<string, unknown>): Promise<EquipmentInspection[]>;
    createInspection(data: CreateEquipmentInspectionInput): Promise<EquipmentInspection>;
    getStats(): Promise<EquipmentStats>;
    count(filters?: Record<string, unknown>): Promise<number>;
}
