import { Router } from "express";
import { authenticateUser, requireRole, type AuthRequest } from "../middleware/auth.js";
import { EsgService } from "../services/esg.service.js";

const router = Router();
const esgService = new EsgService();

router.get("/carbon", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.scope))) filters.scope = String(String(String(req.query.scope)));
    if (String(String(req.query.period))) filters.period = String(String(String(req.query.period)));
    if (String(String(req.query.site))) filters.site = String(String(String(req.query.site)));
    const emissions = await esgService.getCarbonEmissions(filters);
    res.json(emissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch carbon emissions" });
  }
});

router.post("/carbon", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req: AuthRequest, res) => {
  try {
    const emission = await esgService.createCarbonEmission(req.body);
    res.status(201).json(emission);
  } catch (error) {
    res.status(500).json({ error: "Failed to create carbon emission record" });
  }
});

router.get("/energy", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.source))) filters.source = String(String(String(req.query.source)));
    if (String(String(req.query.period))) filters.period = String(String(String(req.query.period)));
    if (String(String(req.query.site))) filters.site = String(String(String(req.query.site)));
    const records = await esgService.getEnergyRecords(filters);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch energy records" });
  }
});

router.post("/energy", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req: AuthRequest, res) => {
  try {
    const record = await esgService.createEnergyRecord(req.body);
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to create energy record" });
  }
});

router.get("/water", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.period))) filters.period = String(String(String(req.query.period)));
    if (String(String(req.query.site))) filters.site = String(String(String(req.query.site)));
    const records = await esgService.getWaterRecords(filters);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch water records" });
  }
});

router.post("/water", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req: AuthRequest, res) => {
  try {
    const record = await esgService.createWaterRecord(req.body);
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to create water record" });
  }
});

router.get("/dashboard", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const dashboard = await esgService.getEsgDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch ESG dashboard" });
  }
});

export default router;

