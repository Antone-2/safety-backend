import { Router } from "express";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";
import { HazardService } from "../services/hazard.service.js";

const router = Router();
const hazardService = new HazardService();

router.get("/", authenticateUser, async (_req: AuthRequest, res) => {
  try {
    const hazards = await hazardService.getAll();
    res.json(hazards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

router.get("/:id", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const hazard = await hazardService.getById(String(req.params.id));
    if (!hazard) return res.status(404).json({ error: "Hazard not found" });
    res.json(hazard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazard" });
  }
});

router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const hazard = await hazardService.create({ ...req.body, createdBy: req.user?.name || "System" });
    res.status(201).json(hazard);
  } catch (error) {
    res.status(500).json({ error: "Failed to create hazard" });
  }
});

router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const hazard = await hazardService.update(String(req.params.id), req.body);
    res.json(hazard);
  } catch (error) {
    res.status(500).json({ error: "Failed to update hazard" });
  }
});

router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const result = await hazardService.delete(String(req.params.id));
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete hazard" });
  }
});

router.get("/stats", authenticateUser, async (_req: AuthRequest, res) => {
  try {
    const stats = await hazardService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hazard stats" });
  }
});

export default router;
