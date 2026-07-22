import { Pool } from "pg";
import { Incident, IncidentInput } from "./incidents.types.js";
export declare class IncidentsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Incident[]>;
    findAllReports(): Promise<Record<string, unknown>[]>;
    findById(id: string): Promise<Incident | null>;
    create(data: IncidentInput): Promise<Incident>;
    update(id: string, data: Partial<IncidentInput>): Promise<Incident | null>;
    delete(id: string): Promise<boolean>;
    count(filters?: Record<string, unknown>): Promise<number>;
}
