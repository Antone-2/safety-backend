import { ExposureMonitoringRepository } from "./exposure-monitoring.repository.js";
import type { CreateExposureMonitoringInput, UpdateExposureMonitoringInput } from "./exposure-monitoring.types.js";
export declare class ExposureMonitoringService {
    private repository;
    constructor(repository: ExposureMonitoringRepository);
    getRecords(filters?: Record<string, unknown>): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord[]>;
    getById(id: string): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord | null>;
    create(data: CreateExposureMonitoringInput): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord>;
    update(id: string, data: UpdateExposureMonitoringInput): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord | null>;
    delete(id: string): Promise<boolean>;
    getExceedances(): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord[]>;
    getOverdueActions(daysBefore?: number): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringRecord[]>;
    getStats(): Promise<import("./exposure-monitoring.types.js").ExposureMonitoringStats>;
}
