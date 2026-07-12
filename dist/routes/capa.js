import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { CapaService } from "../services/capa.service.js";
const router = Router();
const capaService = new CapaService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const records = await capaService.getAll();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch CAPA records" });
    }
});
router.get("/dashboard", authenticateUser, async (_req, res) => {
    try {
        const dashboard = await capaService.getCapaDashboard();
        res.json(dashboard);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch CAPA dashboard" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await capaService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch CAPA stats" });
    }
});
router.get("/overdue", authenticateUser, async (_req, res) => {
    try {
        const records = await capaService.getOverdue();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch overdue CAPA" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await capaService.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "CAPA not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch CAPA" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await capaService.createCapa({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create CAPA" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await capaService.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update CAPA" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await capaService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete CAPA" });
    }
});
router.post("/:id/verify", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const { verificationNote, verifiedBy } = req.body;
        const record = await capaService.update(String(req.params.id), {
            status: "Completed",
            completedDate: new Date().toISOString(),
            verificationNote,
            verifiedBy,
        });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to verify CAPA" });
    }
});
export default router;
