import { Router } from "express";
import { z } from "zod";
import { authenticateUser, requirePermission } from "../shared/middleware/auth.middleware.js";
import { writeAuditLog } from "../shared/audit/audit.service.js";
import { ROLE_PERMISSIONS } from "../shared/middleware/rbac.middleware.js";
const router = Router();
const PermissionMatrixSchema = z.record(z.array(z.string()));
router.get("/", authenticateUser, requirePermission("users:read"), async (_req, res) => {
    const matrix = Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
        role,
        permissions,
    }));
    res.json({ data: matrix });
});
router.put("/", authenticateUser, requirePermission("users:update"), async (req, res) => {
    const parsed = PermissionMatrixSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const updates = parsed.data;
    const invalidRoles = Object.keys(updates).filter((role) => !(role in ROLE_PERMISSIONS) && role !== "super-admin");
    if (invalidRoles.length > 0) {
        return res.status(400).json({ error: `Unknown roles: ${invalidRoles.join(", ")}` });
    }
    for (const [role, permissions] of Object.entries(updates)) {
        if (!Array.isArray(permissions))
            continue;
        const clean = permissions.filter((p) => typeof p === "string" && p.length > 0);
        ROLE_PERMISSIONS[role] = clean;
    }
    await writeAuditLog({
        action: "permission-matrix.update",
        resourceType: "permission-matrix",
        actor: req.user,
        request: req,
        context: { updatedRoles: Object.keys(updates) },
    });
    const matrix = Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
        role,
        permissions,
    }));
    res.json({ data: matrix });
});
router.get("/roles/:role", authenticateUser, requirePermission("users:read"), async (req, res) => {
    const role = String(req.params.role);
    if (!(role in ROLE_PERMISSIONS)) {
        return res.status(404).json({ error: "Role not found" });
    }
    res.json({ data: { role, permissions: ROLE_PERMISSIONS[role] } });
});
router.patch("/roles/:role", authenticateUser, requirePermission("users:update"), async (req, res) => {
    const role = String(req.params.role);
    if (!(role in ROLE_PERMISSIONS)) {
        return res.status(404).json({ error: "Role not found" });
    }
    const patchSchema = z.object({
        add: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
        set: z.array(z.string()).optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const current = [...(ROLE_PERMISSIONS[role] ?? [])];
    if (parsed.data.set) {
        ROLE_PERMISSIONS[role] = parsed.data.set.filter((p) => typeof p === "string" && p.length > 0);
    }
    else {
        if (parsed.data.add) {
            for (const perm of parsed.data.add) {
                if (!current.includes(perm))
                    current.push(perm);
            }
        }
        if (parsed.data.remove) {
            for (const perm of parsed.data.remove) {
                const idx = current.indexOf(perm);
                if (idx >= 0)
                    current.splice(idx, 1);
            }
        }
        ROLE_PERMISSIONS[role] = current;
    }
    await writeAuditLog({
        action: "permission-matrix.patch",
        resourceType: "permission-matrix",
        resourceId: role,
        actor: req.user,
        request: req,
        context: { role, patch: parsed.data },
    });
    res.json({ data: { role, permissions: ROLE_PERMISSIONS[role] } });
});
export default router;
