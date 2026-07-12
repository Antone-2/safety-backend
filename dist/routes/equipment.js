import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { EquipmentService } from "../services/equipment.service.js";
const router = Router();
const equipmentService = new EquipmentService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.site)))
            filters.site = String(String(String(req.query.site)));
        const equipment = await equipmentService.getEquipment(filters);
        res.json(equipment);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch equipment" });
    }
});
router.get("/inspections", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.equipmentId)))
            filters.equipmentId = String(String(String(req.query.equipmentId)));
        const inspections = await equipmentService.getInspections(filters);
        res.json(inspections);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch inspections" });
    }
});
router.post("/inspections", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "maintenance-manager"]), async (req, res) => {
    try {
        const inspection = await equipmentService.createInspection(req.body);
        res.status(201).json(inspection);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create inspection" });
    }
});
router.get("/overdue", authenticateUser, async (_req, res) => {
    try {
        const overdue = await equipmentService.getOverdueInspections();
        res.json(overdue);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch overdue inspections" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await equipmentService.getEquipmentStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch equipment stats" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const item = await equipmentService.getEquipmentById(String(String(req.params.id)));
        if (!item)
            return res.status(404).json({ error: "Equipment not found" });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch equipment" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "maintenance-manager"]), async (req, res) => {
    try {
        const item = await equipmentService.createEquipment(req.body);
        res.status(201).json(item);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create equipment" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "maintenance-manager"]), async (req, res) => {
    try {
        const item = await equipmentService.updateEquipment(String(String(req.params.id)), req.body);
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update equipment" });
    }
});
export default router;
