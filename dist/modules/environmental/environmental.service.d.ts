import { WasteRecord, Emission, Chemical, Spill, CreateWasteInput, UpdateWasteInput, CreateEmissionInput, UpdateEmissionInput, CreateChemicalInput, UpdateChemicalInput, CreateSpillInput, UpdateSpillInput, EnvironmentalStats } from "./environmental.types.js";
import { EnvironmentalRepository } from "./environmental.repository.js";
export declare class EnvironmentalService {
    private repository;
    constructor(repository: EnvironmentalRepository);
    getWaste(filters?: Record<string, unknown>): Promise<WasteRecord[]>;
    createWaste(data: CreateWasteInput): Promise<WasteRecord>;
    updateWaste(id: string, data: UpdateWasteInput): Promise<WasteRecord | null>;
    getEmissions(filters?: Record<string, unknown>): Promise<Emission[]>;
    createEmission(data: CreateEmissionInput): Promise<Emission>;
    updateEmission(id: string, data: UpdateEmissionInput): Promise<Emission | null>;
    getChemicals(filters?: Record<string, unknown>): Promise<Chemical[]>;
    createChemical(data: CreateChemicalInput): Promise<Chemical>;
    updateChemical(id: string, data: UpdateChemicalInput): Promise<Chemical | null>;
    getSpills(filters?: Record<string, unknown>): Promise<Spill[]>;
    createSpill(data: CreateSpillInput): Promise<Spill>;
    updateSpill(id: string, data: UpdateSpillInput): Promise<Spill | null>;
    getEnvironmentalStats(): Promise<EnvironmentalStats>;
}
