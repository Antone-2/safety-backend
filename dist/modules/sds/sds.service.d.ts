import { Sds, CreateSdsInput, UpdateSdsInput, SdsStats } from "./sds.types.js";
import { SdsRepository } from "./sds.repository.js";
export declare class SdsService {
    private repository;
    constructor(repository: SdsRepository);
    getAll(filters?: Record<string, unknown>): Promise<Sds[]>;
    getById(id: string): Promise<Sds | null>;
    searchByChemical(name: string): Promise<Sds[]>;
    create(data: CreateSdsInput): Promise<Sds>;
    update(id: string, data: UpdateSdsInput): Promise<Sds | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<SdsStats>;
}
