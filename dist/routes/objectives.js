import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { ObjectivesService } from "../services/objectives.service.js";
const router = Router();
const service = new ObjectivesService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(req.query.department))
            filters.department = String(req.query.department);
        if (String(req.query.site))
            filters.site = String(req.query.site);
        if (String(req.query.status))
            filters.status = String(req.query.status);
        if (String(req.query.owner))
            filters.owner = String(req.query.owner);
        const records = await service.getAll(filters);
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch objectives" });
    }
});
router.get("/dashboard", authenticateUser, async (_req, res) => {
    try {
        const stats = await service.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch objectives dashboard" });
    }
});
router.get("/at-risk", authenticateUser, async (_req, res) => {
    try {
        const records = await service.getAtRisk();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch at-risk objectives" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await service.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Objective not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch objective" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await service.createObjective({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create objective" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await service.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update objective" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await service.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete objective" });
    }
});
export default router;
