import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { ContractorService } from "../services/contractor.service.js";
const router = Router();
const contractorService = new ContractorService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.companyName)))
            filters.companyName = String(String(String(req.query.companyName)));
        const contractors = await contractorService.getContractors(filters);
        res.json(contractors);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch contractors" });
    }
});
router.get("/stats/summary", authenticateUser, async (_req, res) => {
    try {
        const stats = await contractorService.getContractorStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch contractor stats" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const contractor = await contractorService.getContractorById(String(String(req.params.id)));
        if (!contractor)
            return res.status(404).json({ error: "Contractor not found" });
        res.json(contractor);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch contractor" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const contractor = await contractorService.createContractor(req.body);
        res.status(201).json(contractor);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create contractor" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const contractor = await contractorService.updateContractor(String(String(req.params.id)), req.body);
        res.json(contractor);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update contractor" });
    }
});
router.post("/incidents", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const incident = await contractorService.recordIncident(req.body);
        res.status(201).json(incident);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to record contractor incident" });
    }
});
router.get("/:id/incidents", authenticateUser, async (req, res) => {
    try {
        const incidents = await contractorService.getContractorIncidents(String(String(req.params.id)));
        res.json(incidents);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch contractor incidents" });
    }
});
export default router;
