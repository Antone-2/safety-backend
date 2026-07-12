import { Pool } from "pg";
import type { Ppe, CreatePpeInput, UpdatePpeInput, PpeStats } from "./ppe.types.js";
export declare class PpeRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Ppe[]>;
    findById(id: string): Promise<Ppe | null>;
    create(data: CreatePpeInput): Promise<Ppe>;
    update(id: string, data: UpdatePpeInput): Promise<Ppe | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<PpeStats>;
}
