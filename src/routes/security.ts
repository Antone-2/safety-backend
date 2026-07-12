import { Router, type Response } from "express";
import {
  authenticateUser,
  type AuthRequest,
} from "../shared/middleware/auth.middleware.js";
import { requireRole } from "../middleware/auth.js";
import { securityHardeningService } from "../services/security-hardening.service.js";

const router = Router();
const securityAdmins = ["super-admin", "EHS-manager"];

router.use(authenticateUser, requireRole(securityAdmins));

router.get("/dashboard", async (_req: AuthRequest, res: Response) => {
  res.json(await securityHardeningService.dashboard());
});

router.get("/policies", async (_req: AuthRequest, res: Response) => {
  res.json(await securityHardeningService.listPolicies());
});

router.put("/policies/:key", async (req: AuthRequest, res: Response) => {
  const policy = await securityHardeningService.upsertPolicy(
    String(req.params.key),
    req.body.policyValue || {},
    String(req.body.description || ""),
    req.user,
  );
  res.json(policy);
});

router.post("/file-scans", async (req: AuthRequest, res: Response) => {
  const scan = await securityHardeningService.recordFileScan({
    fileKey: String(req.body.fileKey),
    fileName: req.body.fileName,
    mimeType: req.body.mimeType,
    sizeBytes: req.body.sizeBytes ? Number(req.body.sizeBytes) : undefined,
    uploadedBy: req.user?.email,
  });
  res.status(scan.status === "blocked" ? 422 : 201).json(scan);
});

router.get("/file-scans", async (req: AuthRequest, res: Response) => {
  res.json(
    await securityHardeningService.listFileScans(
      typeof req.query.status === "string" ? req.query.status : undefined,
    ),
  );
});

router.get("/retention", async (_req: AuthRequest, res: Response) => {
  res.json(await securityHardeningService.listRetentionPolicies());
});

router.put(
  "/retention/:resourceType",
  async (req: AuthRequest, res: Response) => {
    const policy = await securityHardeningService.upsertRetentionPolicy(
      { ...req.body, resourceType: String(req.params.resourceType) },
      req.user,
    );
    res.json(policy);
  },
);

router.get("/secrets-rotation", async (_req: AuthRequest, res: Response) => {
  res.json(await securityHardeningService.listSecretRotations());
});

router.post("/secrets-rotation", async (req: AuthRequest, res: Response) => {
  const rotation = await securityHardeningService.recordSecretRotation(
    req.body,
    req.user,
  );
  res.status(201).json(rotation);
});

export default router;
