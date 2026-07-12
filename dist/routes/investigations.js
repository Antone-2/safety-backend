import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { InvestigationService } from "../services/investigation.service.js";
const router = Router();
const service = new InvestigationService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const records = await service.getAll();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch investigations" });
    }
});
router.get("/dashboard", authenticateUser, async (_req, res) => {
    try {
        const stats = await service.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch investigation stats" });
    }
});
router.get("/incident/:incidentId", authenticateUser, async (req, res) => {
    try {
        const records = await service.getByIncidentId(String(req.params.incidentId));
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch investigations" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await service.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Investigation not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch investigation" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await service.createInvestigation({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create investigation" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update investigation" });
    }
});
router.post("/:id/evidence", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.addEvidence(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to add evidence" });
    }
});
router.post("/:id/complete", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.completeInvestigation(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to complete investigation" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await service.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete investigation" });
    }
});
export default router;
