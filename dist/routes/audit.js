import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { AuditService } from "../services/audit.service.js";
const router = Router();
const service = new AuditService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(req.query.site))
            filters.site = String(req.query.site);
        if (String(req.query.department))
            filters.department = String(req.query.department);
        if (String(req.query.status))
            filters.status = String(req.query.status);
        if (String(req.query.type))
            filters.type = String(req.query.type);
        const records = await service.getAll(filters);
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch audits" });
    }
});
router.get("/dashboard", authenticateUser, async (_req, res) => {
    try {
        const stats = await service.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch audit dashboard" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await service.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Audit not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch audit" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.createAudit({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create audit" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update audit" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await service.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete audit" });
    }
});
export default router;
