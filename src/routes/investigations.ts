import { Router } from "express";
import { authenticateUser, requirePermission, type AuthRequest } from "../shared/middleware/auth.middleware.js";
import { InvestigationService, InvestigationSchema } from "../services/investigation.service.js";
import { validate } from "../shared/middleware/validation.middleware.js";

const router = Router();
const service = new InvestigationService();

router.get("/", authenticateUser, async (_req: AuthRequest, res) => {
  try {
    const records = await service.getAll();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch investigations" });
  }
});

router.get("/dashboard", authenticateUser, requirePermission("investigations:read"), async (_req: AuthRequest, res) => {
  try {
    const stats = await service.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch investigation stats" });
  }
});

router.get("/incident/:incidentId", authenticateUser, requirePermission("investigations:read"), async (req: AuthRequest, res) => {
  try {
    const records = await service.getByIncidentId(String(req.params.incidentId));
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch investigations" });
  }
});

router.get("/:id", authenticateUser, requirePermission("investigations:read"), async (req: AuthRequest, res) => {
  try {
    const record = await service.getById(String(req.params.id));
    if (!record) return res.status(404).json({ error: "Investigation not found" });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch investigation" });
  }
});

router.post("/", authenticateUser, requirePermission("investigations:create"), validate(InvestigationSchema), async (req: AuthRequest, res) => {
  try {
    const record = await service.createInvestigation({ ...req.body, createdBy: req.user?.name || "System" });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to create investigation" });
  }
});

router.patch("/:id", authenticateUser, requirePermission("investigations:update"), validate(InvestigationSchema.partial()), async (req: AuthRequest, res) => {
  try {
    const record = await service.update(String(req.params.id), req.body);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to update investigation" });
  }
});

router.post("/:id/evidence", authenticateUser, requirePermission("investigations:update"), async (req: AuthRequest, res) => {
  try {
    const record = await service.addEvidence(String(req.params.id), req.body);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to add evidence" });
  }
});

router.post("/:id/complete", authenticateUser, requirePermission("investigations:update"), async (req: AuthRequest, res) => {
  try {
    const record = await service.completeInvestigation(String(req.params.id), req.body);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to complete investigation" });
  }
});

router.delete("/:id", authenticateUser, requirePermission("investigations:delete"), async (req: AuthRequest, res) => {
  try {
    const result = await service.delete(String(req.params.id));
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete investigation" });
  }
});

export default router;
