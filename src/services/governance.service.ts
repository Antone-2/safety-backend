import { BaseService } from "./base.service.js";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const UserRoleSchema = z.enum([
  "super-admin",
  "EHS-manager",
  "she-committee-member",
  "supervisor",
  "gm",
  "plant-manager",
  "factory-manager",
  "depot-admin",
  "hse-officer",
  "employee",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().max(200),
  passwordHash: z.string().optional(),
  name: z.string().min(1).max(200),
  role: UserRoleSchema,
  site: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Locked"]).default("Active"),
  lastLogin: z.string().optional(),
  createdAt: z.string().optional(),
});

export const PermissionSchema = z.object({
  id: z.string().optional(),
  role: UserRoleSchema,
  resource: z.string().min(1).max(100),
  actions: z.string().min(1).max(200),
  conditions: z.string().max(500).optional(),
});

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  actor: z.string().min(1).max(200),
  actorRole: z.string().max(100).optional(),
  action: z.string().min(1).max(100),
  resource: z.string().min(1).max(100),
  resourceId: z.string().max(100).optional(),
  details: z.string().max(2000).optional(),
  ipAddress: z.string().max(50).optional(),
  userAgent: z.string().max(500).optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});

export class GovernanceService {
  private userService: BaseService;
  private permissionService: BaseService;
  private auditService: BaseService;

  constructor() {
    this.userService = new BaseService("users", UserSchema);
    this.permissionService = new BaseService("permissions", PermissionSchema);
    this.auditService = new BaseService("audit_logs", AuditLogSchema);
  }

  async createUser(data: Omit<z.infer<typeof UserSchema>, "id" | "createdAt"> & { password?: string }) {
    const { password, ...userData } = data;
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const user = await this.userService.create({
      ...userData,
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    const { passwordHash: _, ...result } = user as any;
    return result;
  }

  async getUsers(filters?: Record<string, any>) {
    const users = await this.userService.getAll(filters);
    return users.map((u: any) => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
  }

  async getUserById(id: string) {
    const user = await this.userService.getById(id);
    if (!user) return null;
    const { passwordHash, ...rest } = user as any;
    return rest;
  }

  async updateUser(id: string, data: Record<string, any>) {
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }
    return this.userService.update(id, data);
  }

  async deleteUser(id: string) {
    return this.userService.delete(id);
  }

  async createPermission(data: z.infer<typeof PermissionSchema>) {
    return this.permissionService.create(data);
  }

  async getPermissions() {
    return this.permissionService.getAll();
  }

  async logAudit(data: z.infer<typeof AuditLogSchema>) {
    return this.auditService.create(data);
  }

  async getAuditLogs(filters?: Record<string, any>) {
    return this.auditService.getAll(filters);
  }

  async getGovernanceStats() {
    const users = await this.userService.getAll();
    const logs = await this.auditService.getAll();
    const activeUsers = users.filter((u: any) => u.status === "Active").length;
    const totalUsers = users.length;
    const today = new Date().toDateString();
    const todayLogs = logs.filter((l: any) => new Date(l.timestamp).toDateString() === today).length;
    return { totalUsers, activeUsers, todayLogs };
  }
}
