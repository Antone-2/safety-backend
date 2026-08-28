import { NotFoundError } from "../../shared/domain/errors/index.js";
import { MOC_WORKFLOW, WorkflowEngine } from "../../shared/workflow/workflow.engine.js";
import { hasPermission } from "../../shared/middleware/rbac.middleware.js";
import type { AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { MocRepository } from "./moc.repository.js";
import type { CreateMocInput, MocStatus, MocTransitionInput, UpdateMocInput } from "./moc.types.js";

export class MocService {
  constructor(private repository: MocRepository) {}

  async getRecords(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    return this.repository.findById(id);
  }

  async create(data: CreateMocInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateMocInput) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("MOC");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("MOC");
    return this.repository.delete(id);
  }

  async transition(id: string, input: MocTransitionInput, actor: AuthRequest["user"]) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError("MOC");
    const engine = new WorkflowEngine(MOC_WORKFLOW);
    const nextStatus = engine.transition(existing.status, input.event, {
      role: actor?.role || "",
      permissions: actor?.role
        ? ["*"].filter(() => actor.role === "super-admin").concat(
            [
              "moc:read",
              "moc:create",
              "moc:update",
              "moc:approve",
              "moc:delete",
            ].filter((permission) => hasPermission(actor.role, permission)),
          )
        : [],
    });

    return this.repository.update(id, {
      status: nextStatus,
      approver: input.approver ?? existing.approver,
      approvedAt:
        input.event === "approve"
          ? input.approvedAt || new Date().toISOString()
          : existing.approvedAt,
      pssrCompleted:
        input.event === "complete-pssr" ? true : existing.pssrCompleted,
      closedAt:
        input.event === "close" ? new Date().toISOString() : existing.closedAt,
      rejectionReason:
        input.event === "reject" ? input.rejectionReason ?? existing.rejectionReason : existing.rejectionReason,
    } as UpdateMocInput & { status: MocStatus });
  }

  async getStats() {
    return this.repository.getStats();
  }
}
