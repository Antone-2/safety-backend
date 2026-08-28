import { ObservationsRepository } from "./observations.repository.js";
import type { CreateObservationInput, UpdateObservationInput } from "./observations.types.js";
export declare class ObservationsService {
    private repository;
    constructor(repository: ObservationsRepository);
    getObservations(filters?: Record<string, unknown>): Promise<import("./observations.types.js").ObservationRecord[]>;
    getObservationById(id: string): Promise<import("./observations.types.js").ObservationRecord | null>;
    createObservation(data: CreateObservationInput): Promise<import("./observations.types.js").ObservationRecord>;
    updateObservation(id: string, data: UpdateObservationInput): Promise<import("./observations.types.js").ObservationRecord | null>;
    deleteObservation(id: string): Promise<boolean>;
    getObservationStats(): Promise<import("./observations.types.js").ObservationStats>;
}
