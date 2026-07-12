import { Router } from "express";
import { authenticateUser, requireRole, } from "../middleware/auth.js";
import { HeightWorkService } from "../services/heightwork.service.js";
const router = Router();
const heightWorkService = new HeightWorkService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const records = await heightWorkService.getAll();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch height work records" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await heightWorkService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch height work stats" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await heightWorkService.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Height work record not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch height work record" });
    }
});
router.post("/", authenticateUser, requireRole([
    "super-admin",
    "EHS-manager",
    "hse-officer",
    "plant-manager",
    "factory-manager",
]), async (req, res) => {
    try {
        const record = await heightWorkService.create({
            ...req.body,
            createdBy: req.user?.name || "System",
        });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create height work record" });
    }
});
router.patch("/:id", authenticateUser, requireRole([
    "super-admin",
    "EHS-manager",
    "hse-officer",
    "plant-manager",
    "factory-manager",
]), async (req, res) => {
    try {
        const record = await heightWorkService.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update height work record" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await heightWorkService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete height work record" });
    }
});
export default router;
