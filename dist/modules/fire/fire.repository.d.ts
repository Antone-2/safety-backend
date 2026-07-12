import { Pool } from "pg";
import type { FireEquipment, FireInspection, CreateFireEquipmentInput, UpdateFireEquipmentInput, CreateFireInspectionInput, FireStats } from "./fire.types.js";
export declare class FireRepository {
    private pool;
    constructor(pool: Pool);
    findEquipment(filters?: Record<string, unknown>): Promise<FireEquipment[]>;
    findEquipmentById(id: string): Promise<FireEquipment | null>;
    createEquipment(data: CreateFireEquipmentInput): Promise<FireEquipment>;
    updateEquipment(id: string, data: UpdateFireEquipmentInput): Promise<FireEquipment | null>;
    deleteEquipment(id: string): Promise<boolean>;
    findInspections(filters?: Record<string, unknown>): Promise<FireInspection[]>;
    createInspection(data: CreateFireInspectionInput): Promise<FireInspection>;
    findOverdue(): Promise<FireEquipment[]>;
    getStats(): Promise<FireStats>;
}
