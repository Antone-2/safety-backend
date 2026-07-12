import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { PpeService } from "../services/ppe.service.js";
const router = Router();
const ppeService = new PpeService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const records = await ppeService.getAll();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch PPE records" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await ppeService.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "PPE record not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch PPE record" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await ppeService.create({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create PPE record" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await ppeService.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update PPE record" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await ppeService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete PPE record" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await ppeService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch PPE stats" });
    }
});
export default router;
