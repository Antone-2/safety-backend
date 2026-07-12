import { Router } from "express";
import { z } from "zod";
import { IncidentService } from "../services/incident.service.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";
const router = Router();
const incidentService = new IncidentService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(req.query.status))
            filters.status = String(String(req.query.status));
        if (String(req.query.severity))
            filters.severity = String(String(req.query.severity));
        if (String(req.query.location))
            filters.location = String(String(req.query.location));
        if (String(req.query.department))
            filters.department = String(String(req.query.department));
        const incidents = await incidentService.getAll(filters);
        res.json(incidents);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch incidents" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const incident = await incidentService.getById(String(req.params.id));
        if (!incident)
            return res.status(404).json({ error: "Incident not found" });
        res.json(incident);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch incident" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin", "supervisor"]), async (req, res) => {
    try {
        const data = req.body;
        const incident = await incidentService.createIncident(data);
        res.status(201).json(incident);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Validation failed", details: error.errors });
        }
        else {
            res.status(500).json({ error: "Failed to create incident" });
        }
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin"]), async (req, res) => {
    try {
        const incident = await incidentService.update(String(req.params.id), req.body);
        res.json(incident);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update incident" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const deleted = await incidentService.delete(String(req.params.id));
        if (!deleted)
            return res.status(404).json({ error: "Incident not found" });
        res.json({ ok: true, deleted: String(req.params.id) });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete incident" });
    }
});
router.get("/stats/summary", authenticateUser, async (req, res) => {
    try {
        const stats = await incidentService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});
router.get("/overdue/list", authenticateUser, async (req, res) => {
    try {
        const overdue = await incidentService.getOverdue();
        res.json(overdue);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch overdue incidents" });
    }
});
export default router;
