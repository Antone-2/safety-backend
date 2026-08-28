import { Pool } from "pg";
import type { CreateObservationInput, ObservationRecord, ObservationStats, UpdateObservationInput } from "./observations.types.js";
export declare class ObservationsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<ObservationRecord[]>;
    findById(id: string): Promise<ObservationRecord | null>;
    create(data: CreateObservationInput): Promise<ObservationRecord>;
    update(id: string, data: UpdateObservationInput): Promise<ObservationRecord | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<ObservationStats>;
}
