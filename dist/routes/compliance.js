import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { ComplianceService } from "../services/compliance.service.js";
const router = Router();
const complianceService = new ComplianceService();
router.get("/obligations", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.site)))
            filters.site = String(String(String(req.query.site)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.responsibility)))
            filters.responsibility = String(String(String(req.query.responsibility)));
        const obligations = await complianceService.getObligations(filters);
        res.json(obligations);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch obligations" });
    }
});
router.post("/obligations", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const obligation = await complianceService.createObligation(req.body);
        res.status(201).json(obligation);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create obligation" });
    }
});
router.patch("/obligations/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const obligation = await complianceService.updateObligation(String(String(req.params.id)), req.body);
        res.json(obligation);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update obligation" });
    }
});
router.get("/audits", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.site)))
            filters.site = String(String(String(req.query.site)));
        const audits = await complianceService.getAudits(filters);
        res.json(audits);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch audits" });
    }
});
router.post("/audits", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const audit = await complianceService.createAudit(req.body);
        res.status(201).json(audit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create audit" });
    }
});
router.patch("/audits/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const audit = await complianceService.updateAudit(String(String(req.params.id)), req.body);
        res.json(audit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update audit" });
    }
});
router.get("/legal-updates", authenticateUser, async (req, res) => {
    try {
        const updates = await complianceService.getLegalUpdates();
        res.json(updates);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch legal updates" });
    }
});
router.post("/legal-updates", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const update = await complianceService.createLegalUpdate(req.body);
        res.status(201).json(update);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create legal update" });
    }
});
router.get("/dashboard", authenticateUser, async (req, res) => {
    try {
        const dashboard = await complianceService.getComplianceDashboard();
        res.json(dashboard);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch compliance dashboard" });
    }
});
export default router;
