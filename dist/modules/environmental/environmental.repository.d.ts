import { Pool } from "pg";
import type { WasteRecord, Emission, Chemical, Spill, CreateWasteInput, UpdateWasteInput, CreateEmissionInput, UpdateEmissionInput, CreateChemicalInput, UpdateChemicalInput, CreateSpillInput, UpdateSpillInput, EnvironmentalStats } from "./environmental.types.js";
export declare class EnvironmentalRepository {
    private pool;
    constructor(pool: Pool);
    findWaste(filters?: Record<string, unknown>): Promise<WasteRecord[]>;
    createWaste(data: CreateWasteInput): Promise<WasteRecord>;
    updateWaste(id: string, data: UpdateWasteInput): Promise<WasteRecord | null>;
    findEmissions(filters?: Record<string, unknown>): Promise<Emission[]>;
    createEmission(data: CreateEmissionInput): Promise<Emission>;
    updateEmission(id: string, data: UpdateEmissionInput): Promise<Emission | null>;
    findChemicals(filters?: Record<string, unknown>): Promise<Chemical[]>;
    createChemical(data: CreateChemicalInput): Promise<Chemical>;
    updateChemical(id: string, data: UpdateChemicalInput): Promise<Chemical | null>;
    findSpills(filters?: Record<string, unknown>): Promise<Spill[]>;
    createSpill(data: CreateSpillInput): Promise<Spill>;
    updateSpill(id: string, data: UpdateSpillInput): Promise<Spill | null>;
    getStats(): Promise<EnvironmentalStats>;
}
