import { Router, type Response } from "express";
import { z } from "zod";
import { WibaService } from "./wiba.service.js";
import { WibaRepository } from "./wiba.repository.js";
import {
  WibaClaimInputSchema,
  WibaClaimPatchSchema,
} from "./wiba.types.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";

export function createWibaController(service: WibaService) {
  return {
    async getClaims(_req: AuthRequest, res: Response) {
      const claims = await service.getClaims();
      res.json({ data: claims });
    },

    async createClaim(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof WibaClaimInputSchema>;
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

    async updateClaim(req: AuthRequest, res: Response) {
      const before = (await service.getClaims()).find(
        (claim) => claim.id === String(req.params.id),
      );
      if (!before) throw new NotFoundError("WIBA claim");
      const claim = await service.updateClaim(
        String(req.params.id),
        req.body as z.infer<typeof WibaClaimPatchSchema>,
      );
      if (!claim) throw new NotFoundError("WIBA claim");
      await writeAuditLog({
        action: "wiba.claim.updated",
        resourceType: "wiba_claim",
        resourceId: claim.id,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          claim as unknown as Record<string, unknown>,
        ),
        actor: req.user,
        request: req,
      });
      res.json({ data: claim });
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

  return router;
}
