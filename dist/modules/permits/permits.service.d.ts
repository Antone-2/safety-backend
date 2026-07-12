import { Permit, CreatePermitInput, UpdatePermitInput, PermitStatus } from "./permits.types.js";
import { PermitsRepository } from "./permits.repository.js";
export declare class PermitsService {
    private repository;
    constructor(repository: PermitsRepository);
    getPermits(filters?: Record<string, unknown>): Promise<Permit[]>;
    getPermitById(id: string): Promise<Permit | null>;
    createPermit(data: CreatePermitInput): Promise<Permit>;
    updatePermit(id: string, data: UpdatePermitInput): Promise<Permit | null>;
    advanceStatus(id: string, newStatus: PermitStatus): Promise<Permit | null>;
    getActivePermits(): Promise<Permit[]>;
    getExpiredPermits(): Promise<Permit[]>;
    addComment(id: string, comment: {
        author: string;
        at: string;
        text: string;
    }): Promise<Permit | null>;
}
