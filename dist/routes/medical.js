import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { MedicalService } from "../services/medical.service.js";
const router = Router();
const medicalService = new MedicalService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const records = await medicalService.getAll();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch medical records" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await medicalService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch medical stats" });
    }
});
router.get("/employee/:employeeId", authenticateUser, async (req, res) => {
    try {
        const records = await medicalService.getRecordsByEmployee(String(req.params.employeeId));
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch employee medical records" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const record = await medicalService.getById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Medical record not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch medical record" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await medicalService.createRecord({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create medical record" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await medicalService.update(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update medical record" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await medicalService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete medical record" });
    }
});
export default router;
