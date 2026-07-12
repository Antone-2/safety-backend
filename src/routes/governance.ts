import { Router } from "express";
import { authenticateUser, requireRole, type AuthRequest } from "../middleware/auth.js";
import { GovernanceService } from "../services/governance.service.js";

const router = Router();
const governanceService = new GovernanceService();

router.get("/users", authenticateUser, requireRole(["super-admin", "EHS-manager", "gm", "plant-manager", "factory-manager", "depot-admin"]), async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.role))) filters.role = String(String(String(req.query.role)));
    if (String(String(req.query.status))) filters.status = String(String(String(req.query.status)));
    if (String(String(req.query.site))) filters.site = String(String(String(req.query.site)));
    const users = await governanceService.getUsers(filters);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const user = await governanceService.getUserById(String(String(req.params.id)));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/users", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const user = await governanceService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/users/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const user = await governanceService.updateUser(String(String(req.params.id)), req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", authenticateUser, requireRole(["super-admin"]), async (req: AuthRequest, res) => {
  try {
    const deleted = await governanceService.deleteUser(String(String(req.params.id)));
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, deleted: String(String(req.params.id)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.get("/permissions", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const permissions = await governanceService.getPermissions();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

router.post("/permissions", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const permission = await governanceService.createPermission(req.body);
    res.status(201).json(permission);
  } catch (error) {
    res.status(500).json({ error: "Failed to create permission" });
  }
});

router.get("/audit-logs", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.actor))) filters.actor = String(String(String(req.query.actor)));
    if (String(String(req.query.action))) filters.action = String(String(String(req.query.action)));
    if (String(String(req.query.resource))) filters.resource = String(String(String(req.query.resource)));
    const logs = await governanceService.getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/stats", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const stats = await governanceService.getGovernanceStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch governance stats" });
  }
});

export default router;

