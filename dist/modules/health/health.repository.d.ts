import { Pool } from "pg";
import type { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, HealthStats } from "./health.types.js";
export declare class HealthRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<HealthRecord[]>;
    findById(id: string): Promise<HealthRecord | null>;
    create(data: CreateHealthRecordInput): Promise<HealthRecord>;
    update(id: string, data: UpdateHealthRecordInput): Promise<HealthRecord | null>;
    delete(id: string): Promise<boolean>;
    findExpiring(daysBefore: number): Promise<HealthRecord[]>;
    getStats(): Promise<HealthStats>;
}
