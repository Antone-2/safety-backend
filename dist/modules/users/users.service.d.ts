import type { AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { UsersRepository } from "./users.repository.js";
import type { CreateUserInput, DelegationInput, UpdateUserInput, UserFilters } from "./users.types.js";
type OrganizationValidator = {
    siteExists(name: string): Promise<boolean>;
    departmentExists(name: string): Promise<boolean>;
    departmentExistsForSite(name: string, siteName: string): Promise<boolean>;
};
export declare class UsersService {
    private repository;
    private organizationValidator?;
    constructor(repository: UsersRepository, organizationValidator?: OrganizationValidator | undefined);
    private validateOrganizationReferences;
    list(filters: UserFilters): Promise<import("./users.types.js").ManagedUser[]>;
    getById(id: string): Promise<import("./users.types.js").ManagedUser>;
    create(input: CreateUserInput, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    update(id: string, input: UpdateUserInput, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    activate(id: string, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    deactivate(id: string, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    delegateAccess(id: string, input: DelegationInput, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    clearDelegation(id: string, req: AuthRequest): Promise<import("./users.types.js").ManagedUser>;
    getAuditTrail(id: string): Promise<any[]>;
    getRoleMatrix(): {
        role: string;
        permissions: import("../../shared/middleware/rbac.middleware.js").Permission[];
    }[];
}
export {};
