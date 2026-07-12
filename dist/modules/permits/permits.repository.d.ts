import { Pool } from "pg";
import type { Permit, CreatePermitInput, UpdatePermitInput } from "./permits.types.js";
export declare class PermitsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Permit[]>;
    findById(id: string): Promise<Permit | null>;
    create(data: CreatePermitInput, createdBy: string): Promise<Permit>;
    update(id: string, data: UpdatePermitInput): Promise<Permit | null>;
    delete(id: string): Promise<boolean>;
    count(filters?: Record<string, unknown>): Promise<number>;
}
