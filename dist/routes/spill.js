import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { SpillService } from "../services/spill.service.js";
const router = Router();
const spillService = new SpillService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const spills = await spillService.getAll();
        res.json(spills);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch spill records" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await spillService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch spill stats" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const spill = await spillService.getById(String(req.params.id));
        if (!spill)
            return res.status(404).json({ error: "Spill record not found" });
        res.json(spill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch spill record" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const spill = await spillService.createSpill({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(spill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create spill record" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const spill = await spillService.update(String(req.params.id), req.body);
        res.json(spill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update spill record" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await spillService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete spill record" });
    }
});
export default router;
