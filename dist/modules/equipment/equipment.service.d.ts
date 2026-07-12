import { Equipment, EquipmentInspection, CreateEquipmentInput, UpdateEquipmentInput, CreateEquipmentInspectionInput, EquipmentStats } from "./equipment.types.js";
import { EquipmentRepository } from "./equipment.repository.js";
export declare class EquipmentService {
    private repository;
    constructor(repository: EquipmentRepository);
    getEquipment(filters?: Record<string, unknown>): Promise<Equipment[]>;
    getEquipmentById(id: string): Promise<Equipment | null>;
    createEquipment(data: CreateEquipmentInput): Promise<Equipment>;
    updateEquipment(id: string, data: UpdateEquipmentInput): Promise<Equipment | null>;
    deleteEquipment(id: string): Promise<boolean>;
    getInspections(filters?: Record<string, unknown>): Promise<EquipmentInspection[]>;
    createInspection(data: CreateEquipmentInspectionInput): Promise<EquipmentInspection>;
    getOverdueInspections(): Promise<Equipment[]>;
    getEquipmentStats(): Promise<EquipmentStats>;
}
