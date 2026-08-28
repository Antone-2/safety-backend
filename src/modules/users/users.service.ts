import { ROLE_PERMISSIONS } from "../../shared/middleware/rbac.middleware.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors/index.js";
import type { AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { UsersRepository } from "./users.repository.js";
import type {
  CreateUserInput,
  DelegationInput,
  UpdateUserInput,
  UserFilters,
} from "./users.types.js";

type OrganizationValidator = {
  siteExists(name: string): Promise<boolean>;
  departmentExists(name: string): Promise<boolean>;
  departmentExistsForSite(name: string, siteName: string): Promise<boolean>;
};

export class UsersService {
  constructor(
    private repository: UsersRepository,
    private organizationValidator?: OrganizationValidator,
  ) {}

  private async validateOrganizationReferences(input: {
    site?: string;
    department?: string;
  }) {
    if (!this.organizationValidator) return;

    if (input.site) {
      const siteExists = await this.organizationValidator.siteExists(input.site);
      if (!siteExists) {
        throw new ValidationError("Selected site does not exist in organization master data");
      }
    }

    if (input.department) {
      const departmentExists = input.site
        ? await this.organizationValidator.departmentExistsForSite(input.department, input.site)
        : await this.organizationValidator.departmentExists(input.department);
      if (!departmentExists) {
        throw new ValidationError("Selected department does not exist in organization master data");
      }
    }
  }

  async list(filters: UserFilters) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  async create(input: CreateUserInput, req: AuthRequest) {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) throw new ConflictError("Email already registered");
    await this.validateOrganizationReferences({
      site: input.site,
      department: input.department,
    });
    const created = await this.repository.create(input);
    if (!created) throw new ValidationError("Failed to create user");
    await writeAuditLog({
      action: "users.create",
      resourceType: "user",
      resourceId: created.id,
      actor: req.user,
      request: req,
      context: { email: created.email, role: created.role, site: created.site, department: created.department },
    });
    return created;
  }

  async update(id: string, input: UpdateUserInput, req: AuthRequest) {
    const before = await this.getById(id);
    if (input.email && input.email !== before.email) {
      const existing = await this.repository.findByEmail(input.email);
      if (existing && existing.id !== id) throw new ConflictError("Email already registered");
    }
    await this.validateOrganizationReferences({
      site: input.site ?? before.site,
      department: input.department ?? before.department,
    });
    const updated = await this.repository.update(id, input);
    if (!updated) throw new NotFoundError("User");
    await writeAuditLog({
      action: "users.update",
      resourceType: "user",
      resourceId: id,
      actor: req.user,
      request: req,
      changes: diffRecord(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
    });
    return updated;
  }

  async activate(id: string, req: AuthRequest) {
    const before = await this.getById(id);
    const updated = await this.repository.setActive(id, true);
    if (!updated) throw new NotFoundError("User");
    await writeAuditLog({
      action: "users.activate",
      resourceType: "user",
      resourceId: id,
      actor: req.user,
      request: req,
      changes: diffRecord(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
    });
    return updated;
  }

  async deactivate(id: string, req: AuthRequest) {
    if (req.user?.id === id) {
      throw new ValidationError("You cannot deactivate your own account");
    }
    const before = await this.getById(id);
    const updated = await this.repository.setActive(id, false);
    if (!updated) throw new NotFoundError("User");
    await writeAuditLog({
      action: "users.deactivate",
      resourceType: "user",
      resourceId: id,
      actor: req.user,
      request: req,
      changes: diffRecord(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
    });
    return updated;
  }

  async delegateAccess(id: string, input: DelegationInput, req: AuthRequest) {
    const before = await this.getById(id);
    if (id === input.delegatedToUserId) {
      throw new ValidationError("A user cannot delegate access to themselves");
    }
    await this.getById(input.delegatedToUserId);
    const updated = await this.repository.setDelegation(id, input);
    if (!updated) throw new NotFoundError("User");
    await writeAuditLog({
      action: "users.delegate-access",
      resourceType: "user",
      resourceId: id,
      actor: req.user,
      request: req,
      changes: diffRecord(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
    });
    return updated;
  }

  async clearDelegation(id: string, req: AuthRequest) {
    const before = await this.getById(id);
    const updated = await this.repository.clearDelegation(id);
    if (!updated) throw new NotFoundError("User");
    await writeAuditLog({
      action: "users.clear-delegation",
      resourceType: "user",
      resourceId: id,
      actor: req.user,
      request: req,
      changes: diffRecord(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
    });
    return updated;
  }

  async getAuditTrail(id: string) {
    await this.getById(id);
    return this.repository.findAuditTrail(id);
  }

  getRoleMatrix() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
    }));
  }
}
