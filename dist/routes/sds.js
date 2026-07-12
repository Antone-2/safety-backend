import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { SdsService } from "../services/sds.service.js";
const router = Router();
const sdsService = new SdsService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const sdsRecords = await sdsService.getAll();
        res.json(sdsRecords);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch SDS records" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const sds = await sdsService.getById(String(req.params.id));
        if (!sds)
            return res.status(404).json({ error: "SDS not found" });
        res.json(sds);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch SDS" });
    }
});
router.get("/search/:chemicalName", authenticateUser, async (req, res) => {
    try {
        const results = await sdsService.searchByChemical(String(req.params.chemicalName));
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to search SDS" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const sds = await sdsService.create({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(sds);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create SDS" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const sds = await sdsService.update(String(req.params.id), req.body);
        res.json(sds);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update SDS" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await sdsService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete SDS" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await sdsService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch SDS stats" });
    }
});
export default router;
