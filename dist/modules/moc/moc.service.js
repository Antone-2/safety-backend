import { NotFoundError } from "../../shared/domain/errors/index.js";
import { MOC_WORKFLOW, WorkflowEngine } from "../../shared/workflow/workflow.engine.js";
import { hasPermission } from "../../shared/middleware/rbac.middleware.js";
export class MocService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getRecords(filters) {
        return this.repository.findAll(filters);
    }
    async getById(id) {
        return this.repository.findById(id);
    }
    async create(data) {
        return this.repository.create(data);
    }
    async update(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("MOC");
        return this.repository.update(id, data);
    }
    async delete(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("MOC");
        return this.repository.delete(id);
    }
    async transition(id, input, actor) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("MOC");
        const engine = new WorkflowEngine(MOC_WORKFLOW);
        const nextStatus = engine.transition(existing.status, input.event, {
            role: actor?.role || "",
            permissions: actor?.role
                ? ["*"].filter(() => actor.role === "super-admin").concat([
                    "moc:read",
                    "moc:create",
                    "moc:update",
                    "moc:approve",
                    "moc:delete",
                ].filter((permission) => hasPermission(actor.role, permission)))
                : [],
        });
        return this.repository.update(id, {
            status: nextStatus,
            approver: input.approver ?? existing.approver,
            approvedAt: input.event === "approve"
                ? input.approvedAt || new Date().toISOString()
                : existing.approvedAt,
            pssrCompleted: input.event === "complete-pssr" ? true : existing.pssrCompleted,
            closedAt: input.event === "close" ? new Date().toISOString() : existing.closedAt,
            rejectionReason: input.event === "reject" ? input.rejectionReason ?? existing.rejectionReason : existing.rejectionReason,
        });
    }
    async getStats() {
        return this.repository.getStats();
    }
}
