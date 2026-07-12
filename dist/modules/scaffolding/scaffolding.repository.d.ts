import { Pool } from "pg";
import type { Scaffold, CreateScaffoldInput, UpdateScaffoldInput, ScaffoldStats } from "./scaffolding.types.js";
export declare class ScaffoldRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Scaffold[]>;
    findById(id: string): Promise<Scaffold | null>;
    create(data: CreateScaffoldInput): Promise<Scaffold>;
    update(id: string, data: UpdateScaffoldInput): Promise<Scaffold | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<ScaffoldStats>;
}
