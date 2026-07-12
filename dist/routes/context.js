import { Router } from "express";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { ContextService } from "../services/context.service.js";
const router = Router();
const service = new ContextService();
router.get("/analysis", authenticateUser, async (_req, res) => {
    try {
        const records = await service.getContexts();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch context analysis" });
    }
});
router.get("/analysis/:id", authenticateUser, async (req, res) => {
    try {
        const record = await service.getContextById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Context analysis not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch context analysis" });
    }
});
router.post("/analysis", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.createContext({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create context analysis" });
    }
});
router.get("/parties", authenticateUser, async (_req, res) => {
    try {
        const records = await service.getParties();
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch interested parties" });
    }
});
router.get("/parties/:id", authenticateUser, async (req, res) => {
    try {
        const record = await service.getPartyById(String(req.params.id));
        if (!record)
            return res.status(404).json({ error: "Interested party not found" });
        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch interested party" });
    }
});
router.post("/parties", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    try {
        const record = await service.createParty({ ...req.body, createdBy: req.user?.name || "System" });
        res.status(201).json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create interested party" });
    }
});
router.delete("/parties/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete interested party" });
    }
});
export default router;
