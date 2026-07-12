import { Router } from "express";
import { authenticateUser, requireRole, } from "../middleware/auth.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { AnalyticsGovernanceService } from "../services/analytics-governance.service.js";
const router = Router();
const analyticsService = new AnalyticsService();
const governanceService = new AnalyticsGovernanceService();
const analyticsManagers = [
    "super-admin",
    "EHS-manager",
    "plant-manager",
    "factory-manager",
];
router.get("/dashboards", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(req.query.type))
            filters.type = String(String(req.query.type));
        if (String(req.query.site))
            filters.site = String(String(req.query.site));
        if (String(req.query.role))
            filters.role = String(String(req.query.role));
        const dashboards = await analyticsService.getDashboards(filters);
        res.json(dashboards);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch dashboards" });
    }
});
router.post("/dashboards", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const dashboard = await analyticsService.createDashboard(req.body);
        res.status(201).json(dashboard);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create dashboard" });
    }
});
router.get("/reports", authenticateUser, async (req, res) => {
    try {
        const reports = await analyticsService.getReports();
        res.json(reports);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});
router.post("/reports", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const report = await analyticsService.createReport(req.body);
        res.status(201).json(report);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create report" });
    }
});
router.post("/reports/:id/generate", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const report = await analyticsService.generateReport(String(req.params.id));
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate report" });
    }
});
router.get("/templates", authenticateUser, async (_req, res) => {
    try {
        const templates = await governanceService.listTemplates();
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch report templates" });
    }
});
router.post("/templates", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const template = await governanceService.createTemplate(req.body, req.user);
        res.status(201).json(template);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create report template" });
    }
});
router.get("/schedules", authenticateUser, requireRole(analyticsManagers), async (_req, res) => {
    try {
        const schedules = await governanceService.listSchedules();
        res.json(schedules);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch report schedules" });
    }
});
router.post("/schedules", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const schedule = await governanceService.createSchedule(req.body, req.user);
        res.status(201).json(schedule);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create report schedule" });
    }
});
router.post("/runs", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const run = await governanceService.generateRun(req.body, req.user);
        res.status(201).json(run);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate governed report run" });
    }
});
router.post("/runs/:id/signoff", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const signoff = await governanceService.signoff(String(req.params.id), req.body, req.user);
        res.status(201).json(signoff);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to sign off report" });
    }
});
router.post("/management-review-pack", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const pack = await governanceService.managementPack("management-review", req.user);
        res.status(201).json(pack);
    }
    catch (error) {
        res
            .status(500)
            .json({ error: "Failed to generate management review pack" });
    }
});
router.post("/board-kpi-pack", authenticateUser, requireRole(analyticsManagers), async (_req, res) => {
    try {
        const pack = await governanceService.managementPack("board-kpi", _req.user);
        res.status(201).json(pack);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate board KPI pack" });
    }
});
router.post("/regulatory-reports", authenticateUser, requireRole(analyticsManagers), async (_req, res) => {
    try {
        const pack = await governanceService.managementPack("regulatory", _req.user);
        res.status(201).json(pack);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate regulatory report" });
    }
});
router.get("/data-quality/warnings", authenticateUser, requireRole(analyticsManagers), async (_req, res) => {
    try {
        const warnings = await governanceService.dataQualityWarnings();
        res.json({ warnings });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch data quality warnings" });
    }
});
router.get("/exports/reports", authenticateUser, requireRole(analyticsManagers), async (req, res) => {
    try {
        const format = String(req.query.format || "json").toLowerCase();
        const exported = await governanceService.exportRows(format);
        res.setHeader("content-type", exported.contentType);
        res.setHeader("content-disposition", `attachment; filename="${exported.fileName}"`);
        res.send(exported.body);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to export reports" });
    }
});
router.get("/stats", authenticateUser, async (req, res) => {
    try {
        const stats = await analyticsService.getAnalyticsStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch analytics stats" });
    }
});
export default router;
