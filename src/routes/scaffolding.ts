import { Router } from "express";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";
import { ScaffoldService } from "../services/scaffold.service.js";

const router = Router();
const scaffoldService = new ScaffoldService();

router.get("/", authenticateUser, async (_req: AuthRequest, res) => {
  try {
    const scaffolds = await scaffoldService.getAll();
    res.json(scaffolds);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scaffolding records" });
  }
});

router.get("/:id", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const scaffold = await scaffoldService.getById(String(req.params.id));
    if (!scaffold) return res.status(404).json({ error: "Scaffolding record not found" });
    res.json(scaffold);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scaffolding record" });
  }
});

router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const scaffold = await scaffoldService.create({ ...req.body, createdBy: req.user?.name || "System" });
    res.status(201).json(scaffold);
  } catch (error) {
    res.status(500).json({ error: "Failed to create scaffolding record" });
  }
});

router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const scaffold = await scaffoldService.update(String(req.params.id), req.body);
    res.json(scaffold);
  } catch (error) {
    res.status(500).json({ error: "Failed to update scaffolding record" });
  }
});

router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const result = await scaffoldService.delete(String(req.params.id));
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete scaffolding record" });
  }
});

router.get("/stats", authenticateUser, async (_req: AuthRequest, res) => {
  try {
    const stats = await scaffoldService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch scaffolding stats" });
  }
});

export default router;
