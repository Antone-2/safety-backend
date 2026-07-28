import { Router } from "express";
import { WibaService } from "./wiba.service.js";
import { WibaRepository } from "./wiba.repository.js";
import { WibaClaimInputSchema, WibaClaimPatchSchema, } from "./wiba.types.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
export function createWibaController(service) {
    return {
        async getClaims(_req, res) {
            const claims = await service.getClaims();
            res.json({ data: claims });
        },
        async createClaim(req, res) {
            const data = req.body;
            const claim = await service.createClaim(data);
            await writeAuditLog({
                action: "wiba.claim.created",
                resourceType: "wiba_claim",
                resourceId: claim.id,
                context: { claimNo: claim.claimNo, claimantName: claim.claimantName },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: claim });
        },
        async updateClaim(req, res) {
            const before = (await service.getClaims()).find((claim) => claim.id === String(req.params.id));
            if (!before)
                throw new NotFoundError("WIBA claim");
            const claim = await service.updateClaim(String(req.params.id), req.body);
            if (!claim)
                throw new NotFoundError("WIBA claim");
            await writeAuditLog({
                action: "wiba.claim.updated",
                resourceType: "wiba_claim",
                resourceId: claim.id,
                changes: diffRecord(before, claim),
                actor: req.user,
                request: req,
            });
            res.json({ data: claim });
        },
        async deleteClaim(req, res) {
            const claim = await service.deleteClaim(String(req.params.id));
            if (!claim)
                throw new NotFoundError("WIBA claim");
            await writeAuditLog({
                action: "wiba.claim.deleted",
                resourceType: "wiba_claim",
                resourceId: claim.id,
                context: { claimNo: claim.claimNo, claimantName: claim.claimantName },
                actor: req.user,
                request: req,
            });
            res.json({ ok: true, deleted: claim.id });
        },
    };
}
export function createWibaRouter() {
    const repository = new WibaRepository(pgPool);
    const service = new WibaService(repository);
    const controller = createWibaController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", rbacMiddleware("wiba:read"), controller.getClaims);
    router.post("/", rbacMiddleware("wiba:create"), validate(WibaClaimInputSchema), controller.createClaim);
    router.patch("/:id", rbacMiddleware("wiba:update"), validate(WibaClaimPatchSchema), controller.updateClaim);
    router.delete("/:id", rbacMiddleware("wiba:delete"), controller.deleteClaim);
    return router;
}
