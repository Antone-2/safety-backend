import { CalibrationsRepository } from "./calibrations.repository.js";
import type { CreateCalibrationInput, UpdateCalibrationInput } from "./calibrations.types.js";
export declare class CalibrationsService {
    private repository;
    constructor(repository: CalibrationsRepository);
    getRecords(filters?: Record<string, unknown>): Promise<import("./calibrations.types.js").CalibrationRecord[]>;
    getById(id: string): Promise<import("./calibrations.types.js").CalibrationRecord | null>;
    create(data: CreateCalibrationInput): Promise<import("./calibrations.types.js").CalibrationRecord>;
    update(id: string, data: UpdateCalibrationInput): Promise<import("./calibrations.types.js").CalibrationRecord>;
    delete(id: string): Promise<true>;
    getOverdue(): Promise<import("./calibrations.types.js").CalibrationRecord[]>;
    getOutOfTolerance(): Promise<import("./calibrations.types.js").CalibrationRecord[]>;
    getStats(): Promise<import("./calibrations.types.js").CalibrationStats>;
}
