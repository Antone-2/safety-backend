import { Pool } from "pg";
import type { Sds, CreateSdsInput, UpdateSdsInput, SdsStats } from "./sds.types.js";
export declare class SdsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Sds[]>;
    findById(id: string): Promise<Sds | null>;
    searchByChemical(name: string): Promise<Sds[]>;
    create(data: CreateSdsInput): Promise<Sds>;
    update(id: string, data: UpdateSdsInput): Promise<Sds | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<SdsStats>;
}
