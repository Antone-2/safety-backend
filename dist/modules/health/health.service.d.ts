import { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, HealthStats } from "./health.types.js";
import { HealthRepository } from "./health.repository.js";
export declare class HealthService {
    private repository;
    constructor(repository: HealthRepository);
    getRecords(filters?: Record<string, unknown>): Promise<HealthRecord[]>;
    getRecordById(id: string): Promise<HealthRecord | null>;
    createRecord(data: CreateHealthRecordInput): Promise<HealthRecord>;
    updateRecord(id: string, data: UpdateHealthRecordInput): Promise<HealthRecord | null>;
    deleteRecord(id: string): Promise<boolean>;
    getExpiringSurveillances(daysBefore?: number): Promise<HealthRecord[]>;
    getHealthStats(): Promise<HealthStats>;
}
