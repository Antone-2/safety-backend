import { Pool } from "pg";
import type { CreateUserInput, DelegationInput, ManagedUser, UpdateUserInput, UserFilters } from "./users.types.js";
export declare class UsersRepository {
    private pool;
    constructor(pool: Pool);
    private baseSelect;
    findAll(filters?: UserFilters): Promise<ManagedUser[]>;
    findById(id: string): Promise<ManagedUser | null>;
    findByEmail(email: string): Promise<ManagedUser | null>;
    create(input: CreateUserInput): Promise<ManagedUser | null>;
    update(id: string, input: UpdateUserInput): Promise<ManagedUser | null>;
    setActive(id: string, active: boolean): Promise<ManagedUser | null>;
    setDelegation(id: string, input: DelegationInput): Promise<ManagedUser | null>;
    clearDelegation(id: string): Promise<ManagedUser | null>;
    findAuditTrail(id: string): Promise<any[]>;
}
