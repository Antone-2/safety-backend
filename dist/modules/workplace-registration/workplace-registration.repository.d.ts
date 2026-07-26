import { Pool } from "pg";
import type { WorkplaceRegistration, CreateWorkplaceRegistrationInput, UpdateWorkplaceRegistrationInput } from "./workplace-registration.types.js";
export declare class WorkplaceRegistrationRepository {
    private pool;
    constructor(pool: Pool);
    seedDefaultsIfEmpty(): Promise<void>;
    findAll(): Promise<WorkplaceRegistration[]>;
    findById(id: string): Promise<WorkplaceRegistration | null>;
    create(data: CreateWorkplaceRegistrationInput): Promise<WorkplaceRegistration>;
    update(id: string, data: UpdateWorkplaceRegistrationInput): Promise<WorkplaceRegistration | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<{
        total: number;
        valid: number;
        expired: number;
        unknown: number;
    }>;
}
