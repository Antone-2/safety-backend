import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { RiskService } from "../services/risk.service.js";
const router = Router();
const riskService = new RiskService();
router.get("/matrices", authenticateUser, async (req, res) => {
    try {
        const matrices = await riskService.getMatrices();
        res.json(matrices);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch risk matrices" });
    }
});
router.post("/matrices", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const matrix = await riskService.createMatrix(req.body);
        res.status(201).json(matrix);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create risk matrix" });
    }
});
router.get("/registers", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        if (String(String(req.query.department)))
            filters.department = String(String(String(req.query.department)));
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        const registers = await riskService.getRegisters(filters);
        res.json(registers);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch risk registers" });
    }
});
router.post("/registers", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const register = await riskService.createRegister(req.body);
        res.status(201).json(register);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create risk register" });
    }
});
router.get("/registers/:id", authenticateUser, async (req, res) => {
    try {
        const register = await riskService.getRegisterById(String(String(req.params.id)));
        if (!register)
            return res.status(404).json({ error: "Risk register not found" });
        res.json(register);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch risk register" });
    }
});
router.patch("/registers/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req, res) => {
    try {
        const register = await riskService.updateRegister(String(String(req.params.id)), req.body);
        res.json(register);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update risk register" });
    }
});
router.get("/bow-ties", authenticateUser, async (req, res) => {
    try {
        const bowties = await riskService.getBowTies();
        res.json(bowties);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch bow-tie analyses" });
    }
});
router.post("/bow-ties", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const bowtie = await riskService.createBowTie(req.body);
        res.status(201).json(bowtie);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create bow-tie analysis" });
    }
});
router.get("/dashboard", authenticateUser, async (req, res) => {
    try {
        const dashboard = await riskService.getRiskDashboard();
        res.json(dashboard);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch risk dashboard" });
    }
});
export default router;
