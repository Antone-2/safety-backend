import { Incident, IncidentInput } from "./incidents.types.js";
import { IncidentsRepository } from "./incidents.repository.js";
export declare class IncidentsService {
    private repository;
    constructor(repository: IncidentsRepository);
    private getCombinedIncidents;
    getAll(filters?: Record<string, unknown>): Promise<Incident[]>;
    getById(id: string): Promise<Incident | null>;
    create(data: IncidentInput): Promise<Incident>;
    update(id: string, data: Partial<IncidentInput>): Promise<Incident | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<{
        total: number;
        open: number;
        investigating: number;
        capaOpen: number;
        closed: number;
        critical: number;
        overdue: number;
    }>;
    getOverdue(): Promise<Incident[]>;
}
