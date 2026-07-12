import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { EmergencyService } from "../services/emergency.service.js";
const router = Router();
const emergencyService = new EmergencyService();
router.get("/plans", authenticateUser, async (req, res) => {
    try {
        const plans = await emergencyService.getPlans();
        res.json(plans);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch emergency plans" });
    }
});
router.get("/plans/:id", authenticateUser, async (req, res) => {
    try {
        const plan = await emergencyService.getPlanById(String(String(req.params.id)));
        if (!plan)
            return res.status(404).json({ error: "Emergency plan not found" });
        res.json(plan);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch emergency plan" });
    }
});
router.post("/plans", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const plan = await emergencyService.createPlan(req.body);
        res.status(201).json(plan);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create emergency plan" });
    }
});
router.patch("/plans/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const plan = await emergencyService.updatePlan(String(String(req.params.id)), req.body);
        res.json(plan);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update emergency plan" });
    }
});
router.get("/drills", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.site)))
            filters.site = String(String(String(req.query.site)));
        const drills = await emergencyService.getDrills(filters);
        res.json(drills);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch drills" });
    }
});
router.post("/drills", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const drill = await emergencyService.createDrill(req.body);
        res.status(201).json(drill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create drill" });
    }
});
router.patch("/drills/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const drill = await emergencyService.updateDrill(String(String(req.params.id)), req.body);
        res.json(drill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update drill" });
    }
});
router.get("/contacts", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.site)))
            filters.site = String(String(String(req.query.site)));
        if (String(String(req.query.isERT)))
            filters.isERT = String(String(req.query.isERT)) === "true";
        const contacts = await emergencyService.getContacts(filters);
        res.json(contacts);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch emergency contacts" });
    }
});
router.post("/contacts", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const contact = await emergencyService.createContact(req.body);
        res.status(201).json(contact);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create contact" });
    }
});
router.patch("/contacts/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const contact = await emergencyService.updateContact(String(String(req.params.id)), req.body);
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update contact" });
    }
});
router.get("/stats", authenticateUser, async (req, res) => {
    try {
        const stats = await emergencyService.getEmergencyStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch emergency stats" });
    }
});
export default router;
