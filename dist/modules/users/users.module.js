import { Router } from "express";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors/index.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";
import { OrganizationRepository } from "../organization/organization.repository.js";
import { OrganizationService } from "../organization/organization.service.js";
import { CreateUserSchema, DelegationSchema, UpdateUserSchema, UserFiltersSchema, } from "./users.types.js";
const service = new UsersService(new UsersRepository(pgPool), new OrganizationService(new OrganizationRepository(pgPool)));
function handleUserError(error, res) {
    if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
        return res.status(409).json({ error: error.message });
    }
    if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "User management request failed" });
}
export function createUsersRouter() {
    const router = Router();
    router.use(authenticateUser);
    router.get("/meta/roles", rbacMiddleware("users:read"), (_req, res) => {
        res.json({ data: service.getRoleMatrix() });
    });
    router.get("/", rbacMiddleware("users:read"), async (req, res) => {
        const parsed = UserFiltersSchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }
        try {
            const users = await service.list(parsed.data);
            res.json({ data: users, count: users.length });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.post("/", rbacMiddleware("users:create"), async (req, res) => {
        const parsed = CreateUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }
        try {
            const user = await service.create(parsed.data, req);
            res.status(201).json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.get("/:id/audit", rbacMiddleware("users:read"), async (req, res) => {
        try {
            const auditTrail = await service.getAuditTrail(String(req.params.id));
            res.json({ data: auditTrail });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.post("/:id/delegate-access", rbacMiddleware("users:update"), async (req, res) => {
        const parsed = DelegationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }
        try {
            const user = await service.delegateAccess(String(req.params.id), parsed.data, req);
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.delete("/:id/delegate-access", rbacMiddleware("users:update"), async (req, res) => {
        try {
            const user = await service.clearDelegation(String(req.params.id), req);
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.post("/:id/activate", rbacMiddleware("users:update"), async (req, res) => {
        try {
            const user = await service.activate(String(req.params.id), req);
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.post("/:id/deactivate", rbacMiddleware("users:delete"), async (req, res) => {
        try {
            const user = await service.deactivate(String(req.params.id), req);
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.get("/:id", rbacMiddleware("users:read"), async (req, res) => {
        try {
            const user = await service.getById(String(req.params.id));
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    router.patch("/:id", rbacMiddleware("users:update"), async (req, res) => {
        const parsed = UpdateUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }
        try {
            const user = await service.update(String(req.params.id), parsed.data, req);
            res.json({ data: user });
        }
        catch (error) {
            handleUserError(error, res);
        }
    });
    return router;
}
