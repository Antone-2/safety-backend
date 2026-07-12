import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { PtwService } from "../services/ptw.service.js";
const router = Router();
const ptwService = new PtwService();
router.get("/", authenticateUser, async (req, res) => {
    try {
        const filters = {};
        if (String(String(req.query.status)))
            filters.status = String(String(String(req.query.status)));
        if (String(String(req.query.type)))
            filters.type = String(String(String(req.query.type)));
        if (String(String(req.query.location)))
            filters.location = String(String(String(req.query.location)));
        const permits = await ptwService.getPermits(filters);
        res.json(permits);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch permits" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const permit = await ptwService.getPermitById(String(String(req.params.id)));
        if (!permit)
            return res.status(404).json({ error: "Permit not found" });
        res.json(permit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch permit" });
    }
});
router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin", "supervisor"]), async (req, res) => {
    try {
        const permit = await ptwService.createPermit(req.body);
        res.status(201).json(permit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create permit" });
    }
});
router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin"]), async (req, res) => {
    try {
        const permit = await ptwService.updatePermit(String(String(req.params.id)), req.body);
        res.json(permit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update permit" });
    }
});
router.post("/:id/advance", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "issuer"]), async (req, res) => {
    try {
        const { status } = req.body;
        const permit = await ptwService.advanceStatus(String(String(req.params.id)), status);
        res.json(permit);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to advance permit status" });
    }
});
router.get("/active/list", authenticateUser, async (req, res) => {
    try {
        const permits = await ptwService.getActivePermits();
        res.json(permits);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch active permits" });
    }
});
router.get("/expired/list", authenticateUser, async (req, res) => {
    try {
        const permits = await ptwService.getExpiredPermits();
        res.json(permits);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch expired permits" });
    }
});
export default router;
