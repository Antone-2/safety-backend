import { WorkplaceRegistrationRepository } from "./workplace-registration.repository.js";
import type { CreateWorkplaceRegistrationInput, UpdateWorkplaceRegistrationInput, WorkplaceRegistration, WorkplaceRegistrationStats } from "./workplace-registration.types.js";
export declare class WorkplaceRegistrationService {
    private repository;
    constructor(repository: WorkplaceRegistrationRepository);
    getRegistrations(): Promise<WorkplaceRegistration[]>;
    getRegistrationById(id: string): Promise<WorkplaceRegistration | null>;
    createRegistration(data: CreateWorkplaceRegistrationInput): Promise<WorkplaceRegistration>;
    updateRegistration(id: string, data: UpdateWorkplaceRegistrationInput): Promise<WorkplaceRegistration | null>;
    deleteRegistration(id: string): Promise<boolean>;
    getStats(): Promise<WorkplaceRegistrationStats>;
}
