import { FireEquipment, FireInspection, CreateFireEquipmentInput, UpdateFireEquipmentInput, CreateFireInspectionInput, FireStats } from "./fire.types.js";
import { FireRepository } from "./fire.repository.js";
export declare class FireService {
    private repository;
    constructor(repository: FireRepository);
    getEquipment(filters?: Record<string, unknown>): Promise<FireEquipment[]>;
    getEquipmentById(id: string): Promise<FireEquipment | null>;
    createEquipment(data: CreateFireEquipmentInput): Promise<FireEquipment>;
    updateEquipment(id: string, data: UpdateFireEquipmentInput): Promise<FireEquipment | null>;
    deleteEquipment(id: string): Promise<boolean>;
    getInspections(filters?: Record<string, unknown>): Promise<FireInspection[]>;
    createInspection(data: CreateFireInspectionInput): Promise<FireInspection>;
    getOverdueInspections(): Promise<FireEquipment[]>;
    getFireStats(): Promise<FireStats>;
}
