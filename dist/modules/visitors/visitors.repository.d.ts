import { Pool } from "pg";
import type { CreateVisitorInput, UpdateVisitorInput, VisitorRecord, VisitorStats } from "./visitors.types.js";
export declare class VisitorsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<VisitorRecord[]>;
    findById(id: string): Promise<VisitorRecord | null>;
    create(data: CreateVisitorInput): Promise<VisitorRecord>;
    update(id: string, data: UpdateVisitorInput): Promise<VisitorRecord | null>;
    delete(id: string): Promise<boolean>;
    findOnSite(): Promise<VisitorRecord[]>;
    findOverdueCheckouts(): Promise<VisitorRecord[]>;
    getStats(): Promise<VisitorStats>;
}
