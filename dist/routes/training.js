import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { TrainingService } from "../services/training.service.js";
const router = Router();
const trainingService = new TrainingService();
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const courses = await trainingService.getCourses();
        res.json(courses);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch training courses" });
    }
});
router.get("/records", authenticateUser, async (req, res) => {
    try {
        const { employeeId, courseId } = req.query;
        const records = await trainingService.getRecords({
            employeeId: employeeId ? String(employeeId) : undefined,
            courseId: courseId ? String(courseId) : undefined,
        });
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch training records" });
    }
});
router.get("/records/:id", authenticateUser, async (req, res) => {
    try {
        const record = await trainingService.getRecordById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Training record not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch training record" });
    }
});
router.post("/courses", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const course = await trainingService.createCourse({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(course);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create course" });
    }
});
router.post("/records", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await trainingService.createRecord({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create training record" });
    }
});
router.patch("/records/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const record = await trainingService.updateRecord(String(req.params.id), req.body);
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update training record" });
    }
});
router.delete("/records/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await trainingService.deleteRecord(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete training record" });
    }
});
router.get("/matrix", authenticateUser, async (_req, res) => {
    try {
        const matrix = await trainingService.getMatrix();
        res.json(matrix);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch training matrix" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await trainingService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch training stats" });
    }
});
export default router;
