import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersService } from "../../src/modules/users/users.service.js";
import type { UsersRepository } from "../../src/modules/users/users.repository.js";
import type { ManagedUser, CreateUserInput, UpdateUserInput, DelegationInput } from "../../src/modules/users/users.types.js";
import { NotFoundError, ConflictError, ValidationError } from "../../src/shared/domain/errors/index.js";

const mockRepository = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
  setDelegation: vi.fn(),
  clearDelegation: vi.fn(),
  findAuditTrail: vi.fn(),
});

const mockOrganizationValidator = () => ({
  siteExists: vi.fn(),
  departmentExists: vi.fn(),
  departmentExistsForSite: vi.fn(),
});

const { mockWriteAuditLog, mockDiffRecord } = vi.hoisted(() => ({
  mockWriteAuditLog: vi.fn(),
  mockDiffRecord: vi.fn(() => []),
}));

vi.mock("../../src/shared/audit/audit.service.js", () => ({
  writeAuditLog: mockWriteAuditLog,
  diffRecord: mockDiffRecord,
}));

describe("UsersService", () => {
  let repository: ReturnType<typeof mockRepository>;
  let organizationValidator: ReturnType<typeof mockOrganizationValidator>;
  let service: UsersService;

  beforeEach(() => {
    repository = mockRepository();
    organizationValidator = mockOrganizationValidator();
    service = new UsersService(repository as unknown as UsersRepository, organizationValidator);
    mockWriteAuditLog.mockReset();
  });

  describe("list", () => {
    it("returns all users when no filters provided", async () => {
      const users = [{ id: "1", email: "a@b.com", name: "A", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" }] as ManagedUser[];
      repository.findAll.mockResolvedValue(users);

      const result = await service.list({});

      expect(result).toBe(users);
      expect(repository.findAll).toHaveBeenCalledWith({});
    });

    it("passes filters to repository", async () => {
      const filters = { role: "super-admin", active: true };
      repository.findAll.mockResolvedValue([]);

      await service.list(filters);

      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe("getById", () => {
    it("returns user when found", async () => {
      const user = { id: "1", email: "a@b.com", name: "A", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;
      repository.findById.mockResolvedValue(user);

      const result = await service.getById("1");

      expect(result).toBe(user);
      expect(repository.findById).toHaveBeenCalledWith("1");
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById("999")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    const createInput: CreateUserInput = {
      email: "new@example.com",
      name: "New User",
      role: "employee",
    };

    it("creates user when email is unique and org references are valid", async () => {
      const created = { id: "1", email: "new@example.com", name: "New User", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(created);

      const result = await service.create(createInput, { user: { id: "admin", email: "admin@test.com", name: "Admin", role: "super-admin" } } as any);

      expect(result).toBe(created);
      expect(repository.create).toHaveBeenCalledWith(createInput);
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        action: "users.create",
        resourceType: "user",
        resourceId: "1",
        actor: { id: "admin", email: "admin@test.com", name: "Admin", role: "super-admin" },
        request: expect.any(Object),
        context: { email: "new@example.com", role: "employee", site: undefined, department: undefined },
      });
    });

    it("throws ConflictError when email already exists", async () => {
      repository.findByEmail.mockResolvedValue({ id: "2" } as ManagedUser);

      await expect(service.create(createInput, {} as any)).rejects.toThrow(ConflictError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("throws ValidationError when site does not exist in org master data", async () => {
      const inputWithSite = { ...createInput, site: "Unknown Site" };
      repository.findByEmail.mockResolvedValue(null);
      organizationValidator.siteExists.mockResolvedValue(false);

      await expect(service.create(inputWithSite, {} as any)).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("throws ValidationError when department does not exist", async () => {
      const inputWithDept = { ...createInput, department: "Unknown Dept" };
      repository.findByEmail.mockResolvedValue(null);
      organizationValidator.departmentExists.mockResolvedValue(false);

      await expect(service.create(inputWithDept, {} as any)).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("throws ValidationError when department does not exist for the given site", async () => {
      const input = { ...createInput, site: "Site A", department: "Dept X" };
      repository.findByEmail.mockResolvedValue(null);
      organizationValidator.siteExists.mockResolvedValue(true);
      organizationValidator.departmentExistsForSite.mockResolvedValue(false);

      await expect(service.create(input, {} as any)).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("validates department for site when both site and department are provided", async () => {
      const input = { ...createInput, site: "Site A", department: "Dept X" };
      repository.findByEmail.mockResolvedValue(null);
      organizationValidator.siteExists.mockResolvedValue(true);
      organizationValidator.departmentExistsForSite.mockResolvedValue(true);
      repository.create.mockResolvedValue({ id: "1", ...input, active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser);

      await service.create(input, {} as any);

      expect(organizationValidator.departmentExistsForSite).toHaveBeenCalledWith("Dept X", "Site A");
    });
  });

  describe("update", () => {
    const existingUser = { id: "1", email: "old@example.com", name: "Old Name", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;

    it("updates user and writes audit log", async () => {
      repository.findById.mockResolvedValueOnce(existingUser).mockResolvedValueOnce({ ...existingUser, name: "New Name" });
      repository.findByEmail.mockResolvedValue(null);
      repository.update.mockResolvedValue({ ...existingUser, name: "New Name" });

      const result = await service.update("1", { name: "New Name" } as UpdateUserInput, { user: { id: "admin" } } as any);

      expect(result.name).toBe("New Name");
      expect(repository.update).toHaveBeenCalledWith("1", { name: "New Name" });
    });

    it("throws ConflictError when updating email to one that already exists", async () => {
      repository.findById.mockResolvedValue(existingUser);
      repository.findByEmail.mockResolvedValue({ id: "2" } as ManagedUser);

      await expect(service.update("1", { email: "taken@example.com" } as UpdateUserInput, {} as any)).rejects.toThrow(ConflictError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update("999", { name: "X" } as UpdateUserInput, {} as any)).rejects.toThrow(NotFoundError);
    });

    it("allows updating email to the same email without conflict", async () => {
      repository.findById.mockResolvedValue(existingUser);
      repository.findByEmail.mockResolvedValue(existingUser);
      repository.update.mockResolvedValue({ ...existingUser, email: "old@example.com" });

      await service.update("1", { email: "old@example.com" } as UpdateUserInput, {} as any);

      expect(repository.update).toHaveBeenCalled();
    });

    it("validates org references on update", async () => {
      repository.findById.mockResolvedValue(existingUser);
      repository.findByEmail.mockResolvedValue(null);
      organizationValidator.siteExists.mockResolvedValue(false);

      await expect(service.update("1", { site: "Bad Site" } as UpdateUserInput, {} as any)).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("activate", () => {
    const inactiveUser = { id: "1", email: "a@b.com", name: "A", role: "employee", active: false, status: "Inactive", createdAt: "", updatedAt: "" } as ManagedUser;

    it("activates user and writes audit log", async () => {
      repository.findById.mockResolvedValue(inactiveUser);
      repository.setActive.mockResolvedValue({ ...inactiveUser, active: true, status: "Active" });

      const result = await service.activate("1", { user: { id: "admin" } } as any);

      expect(result.active).toBe(true);
      expect(repository.setActive).toHaveBeenCalledWith("1", true);
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        action: "users.activate",
        resourceType: "user",
        resourceId: "1",
        actor: { id: "admin" },
        request: expect.any(Object),
        changes: [],
      });
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.activate("999", {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe("deactivate", () => {
    const activeUser = { id: "1", email: "a@b.com", name: "A", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;

    it("deactivates user when actor is not the same user", async () => {
      repository.findById.mockResolvedValue(activeUser);
      repository.setActive.mockResolvedValue({ ...activeUser, active: false, status: "Inactive" });

      const result = await service.deactivate("1", { user: { id: "other" } } as any);

      expect(result.active).toBe(false);
      expect(repository.setActive).toHaveBeenCalledWith("1", false);
    });

    it("throws ValidationError when user tries to deactivate themselves", async () => {
      repository.findById.mockResolvedValue(activeUser);

      await expect(service.deactivate("1", { user: { id: "1" } } as any)).rejects.toThrow("You cannot deactivate your own account");
      expect(repository.setActive).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deactivate("999", { user: { id: "other" } } as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe("delegateAccess", () => {
    const user = { id: "1", email: "a@b.com", name: "A", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;
    const targetUser = { id: "2", email: "b@b.com", name: "B", role: "employee", active: true, status: "Active", createdAt: "", updatedAt: "" } as ManagedUser;
    const delegationInput: DelegationInput = {
      delegatedToUserId: "2",
      delegatedFrom: "A",
      delegatedUntil: new Date(Date.now() + 86400000).toISOString(),
    };

    it("delegates access and writes audit log", async () => {
      repository.findById.mockResolvedValueOnce(user).mockResolvedValueOnce(targetUser);
      repository.setDelegation.mockResolvedValue({ ...user, ...delegationInput });

      const result = await service.delegateAccess("1", delegationInput, { user: { id: "admin" } } as any);

      expect(result).toBeDefined();
      expect(repository.setDelegation).toHaveBeenCalledWith("1", delegationInput);
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        action: "users.delegate-access",
        resourceType: "user",
        resourceId: "1",
        actor: { id: "admin" },
        request: expect.any(Object),
        changes: [],
      });
    });

    it("throws ValidationError when user delegates to themselves", async () => {
      repository.findById.mockResolvedValue(user);

      const selfDelegation = { ...delegationInput, delegatedToUserId: "1" };

      await expect(service.delegateAccess("1", selfDelegation, {} as any)).rejects.toThrow("A user cannot delegate access to themselves");
      expect(repository.setDelegation).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when target user does not exist", async () => {
      repository.findById.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

      await expect(service.delegateAccess("1", delegationInput, {} as any)).rejects.toThrow(NotFoundError);
      expect(repository.setDelegation).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when source user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delegateAccess("999", delegationInput, {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe("clearDelegation", () => {
    const delegatedUser = {
      id: "1",
      email: "a@b.com",
      name: "A",
      role: "employee",
      active: true,
      status: "Delegated",
      delegatedToUserId: "2",
      createdAt: "",
      updatedAt: "",
    } as ManagedUser;

    it("clears delegation and writes audit log", async () => {
      repository.findById.mockResolvedValue(delegatedUser);
      repository.clearDelegation.mockResolvedValue({ ...delegatedUser, delegatedToUserId: undefined, status: "Active" });

      const result = await service.clearDelegation("1", { user: { id: "admin" } } as any);

      expect(result.delegatedToUserId).toBeUndefined();
      expect(repository.clearDelegation).toHaveBeenCalledWith("1");
      expect(mockWriteAuditLog).toHaveBeenCalledWith({
        action: "users.clear-delegation",
        resourceType: "user",
        resourceId: "1",
        actor: { id: "admin" },
        request: expect.any(Object),
        changes: [],
      });
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.clearDelegation("999", {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe("getAuditTrail", () => {
    it("returns audit trail for existing user", async () => {
      repository.findById.mockResolvedValue({ id: "1" } as ManagedUser);
      repository.findAuditTrail.mockResolvedValue([{ id: "log-1", action: "users.create" }]);

      const result = await service.getAuditTrail("1");

      expect(result).toEqual([{ id: "log-1", action: "users.create" }]);
      expect(repository.findAuditTrail).toHaveBeenCalledWith("1");
    });

    it("throws NotFoundError when user does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getAuditTrail("999")).rejects.toThrow(NotFoundError);
    });
  });

  describe("getRoleMatrix", () => {
    it("returns role/permission mapping", () => {
      const matrix = service.getRoleMatrix();

      expect(matrix).toBeInstanceOf(Array);
      expect(matrix.length).toBeGreaterThan(0);
      expect(matrix[0]).toHaveProperty("role");
      expect(matrix[0]).toHaveProperty("permissions");
    });
  });
});
