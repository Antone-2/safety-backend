import { Ppe, CreatePpeInput, UpdatePpeInput, PpeStats } from "./ppe.types.js";
import { PpeRepository } from "./ppe.repository.js";
export declare class PpeService {
    private repository;
    constructor(repository: PpeRepository);
    getAll(filters?: Record<string, unknown>): Promise<Ppe[]>;
    getById(id: string): Promise<Ppe | null>;
    create(data: CreatePpeInput): Promise<Ppe>;
    update(id: string, data: UpdatePpeInput): Promise<Ppe | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<PpeStats>;
}
