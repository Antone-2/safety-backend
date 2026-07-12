import { Router } from "express";
import { authenticateUser, requireRole, } from "../../shared/middleware/auth.middleware.js";
export function createUsersRouter() {
    const router = Router();
    router.use(authenticateUser);
    router.get("/", requireRole(["super-admin", "EHS-manager"]), (_req, res) => {
        res.json({ message: "Users endpoint ready" });
    });
    router.get("/:id", requireRole(["super-admin", "EHS-manager"]), (req, res) => {
        res.json({ message: `User ${req.params.id}` });
    });
    return router;
}
