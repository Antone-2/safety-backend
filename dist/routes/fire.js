import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { FireService } from "../services/fire.service.js";
const router = Router();
const fireService = new FireService();
router.get("/equipment", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        const equipment = await fireService.getEquipment(filters);
        res.json(equipment);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch fire equipment" });
    }
});
router.post("/equipment", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const equipment = await fireService.createEquipment(req.body);
        res.status(201).json(equipment);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create fire equipment" });
    }
});
router.patch("/equipment/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const equipment = await fireService.getEquipmentById(String(String(req.params.id)));
        if (!equipment)
            return res.status(404).json({ error: "Fire equipment not found" });
        const updated = await fireService["equipmentService"].update(String(String(req.params.id)), req.body);
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update fire equipment" });
    }
});
router.get("/inspections", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.equipmentId)))
            filters.equipmentId = String(String(String(req.query.equipmentId)));
        const inspections = await fireService.getInspections(filters);
        res.json(inspections);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch fire inspections" });
    }
});
router.post("/inspections", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const inspection = await fireService.createInspection(req.body);
        res.status(201).json(inspection);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create inspection" });
    }
});
router.get("/overdue", authenticateUser, async (req, res) => {
    try {
        const overdue = await fireService.getOverdueInspections();
        res.json(overdue);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch overdue inspections" });
    }
});
router.get("/stats", authenticateUser, async (req, res) => {
    try {
        const stats = await fireService.getFireStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch fire stats" });
    }
});
export default router;
