import { VisitorsRepository } from "./visitors.repository.js";
import type { CreateVisitorInput, UpdateVisitorInput } from "./visitors.types.js";
export declare class VisitorsService {
    private repository;
    constructor(repository: VisitorsRepository);
    getVisitors(filters?: Record<string, unknown>): Promise<import("./visitors.types.js").VisitorRecord[]>;
    getById(id: string): Promise<import("./visitors.types.js").VisitorRecord | null>;
    create(data: CreateVisitorInput): Promise<import("./visitors.types.js").VisitorRecord>;
    update(id: string, data: UpdateVisitorInput): Promise<import("./visitors.types.js").VisitorRecord>;
    delete(id: string): Promise<true>;
    getOnSite(): Promise<import("./visitors.types.js").VisitorRecord[]>;
    getOverdueCheckouts(): Promise<import("./visitors.types.js").VisitorRecord[]>;
    getStats(): Promise<import("./visitors.types.js").VisitorStats>;
}
