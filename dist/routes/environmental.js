import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { EnvironmentalService } from "../services/environmental.service.js";
const router = Router();
const environmentalService = new EnvironmentalService();
router.get("/waste", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        const waste = await environmentalService.getWaste(filters);
        res.json(waste);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch waste records" });
    }
});
router.post("/waste", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await environmentalService.createWaste(req.body);
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create waste record" });
    }
});
router.get("/emissions", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        const emissions = await environmentalService.getEmissions(filters);
        res.json(emissions);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch emissions" });
    }
});
router.post("/emissions", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const emission = await environmentalService.createEmission(req.body);
        res.status(201).json(emission);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create emission record" });
    }
});
router.get("/chemicals", authenticateUser, async (req, res) => {
    try {
        const chemicals = await environmentalService.getChemicals();
        res.json(chemicals);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch chemicals" });
    }
});
router.post("/chemicals", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const chemical = await environmentalService.createChemical(req.body);
        res.status(201).json(chemical);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create chemical record" });
    }
});
router.get("/spills", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.severity)))
            filters.severity = String(String(String(req.query.severity)));
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        const spills = await environmentalService.getSpills(filters);
        res.json(spills);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch spills" });
    }
});
router.post("/spills", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const spill = await environmentalService.createSpill(req.body);
        res.status(201).json(spill);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create spill record" });
    }
});
router.get("/stats", authenticateUser, async (req, res) => {
    try {
        const stats = await environmentalService.getEnvironmentalStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch environmental stats" });
    }
});
export default router;
