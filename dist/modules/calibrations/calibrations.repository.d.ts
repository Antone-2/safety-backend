import { Pool } from "pg";
import type { CalibrationRecord, CalibrationStats, CreateCalibrationInput, UpdateCalibrationInput } from "./calibrations.types.js";
export declare class CalibrationsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<CalibrationRecord[]>;
    findById(id: string): Promise<CalibrationRecord | null>;
    create(data: CreateCalibrationInput): Promise<CalibrationRecord>;
    update(id: string, data: UpdateCalibrationInput): Promise<CalibrationRecord | null>;
    delete(id: string): Promise<boolean>;
    findOverdue(): Promise<CalibrationRecord[]>;
    findOutOfTolerance(): Promise<CalibrationRecord[]>;
    getStats(): Promise<CalibrationStats>;
}
