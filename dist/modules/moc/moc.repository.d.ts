import { Pool } from "pg";
import type { CreateMocInput, MocRecord, MocStats, UpdateMocInput } from "./moc.types.js";
export declare class MocRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<MocRecord[]>;
    findById(id: string): Promise<MocRecord | null>;
    create(data: CreateMocInput): Promise<MocRecord>;
    update(id: string, data: UpdateMocInput): Promise<MocRecord | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<MocStats>;
}
