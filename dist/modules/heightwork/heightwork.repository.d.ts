import { Pool } from "pg";
import type { HeightWork, CreateHeightWorkInput, UpdateHeightWorkInput, HeightWorkStats } from "./heightwork.types.js";
export declare class HeightWorkRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<HeightWork[]>;
    findById(id: string): Promise<HeightWork | null>;
    create(data: CreateHeightWorkInput): Promise<HeightWork>;
    update(id: string, data: UpdateHeightWorkInput): Promise<HeightWork | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<HeightWorkStats>;
}
