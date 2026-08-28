import { Pool } from "pg";
import type { CreateExposureMonitoringInput, ExposureMonitoringRecord, ExposureMonitoringStats, UpdateExposureMonitoringInput } from "./exposure-monitoring.types.js";
export declare class ExposureMonitoringRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<ExposureMonitoringRecord[]>;
    findById(id: string): Promise<ExposureMonitoringRecord | null>;
    create(data: CreateExposureMonitoringInput): Promise<ExposureMonitoringRecord>;
    update(id: string, data: UpdateExposureMonitoringInput): Promise<ExposureMonitoringRecord | null>;
    delete(id: string): Promise<boolean>;
    findExceedances(): Promise<ExposureMonitoringRecord[]>;
    findOverdueActions(daysBefore: number): Promise<ExposureMonitoringRecord[]>;
    getStats(): Promise<ExposureMonitoringStats>;
}
