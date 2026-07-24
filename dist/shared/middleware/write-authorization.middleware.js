import { authenticateUser } from "./auth.middleware.js";
import { recordAuthFailure } from "./rbac.middleware.js";
import { mfaService } from "../../services/mfa.service.js";
export const PRIVILEGED_WRITE_ROLES = ["super-admin", "EHS-manager"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_WRITE_EXEMPTIONS = new Set([
    "/auth/login",
    "/auth/otp/request",
    "/auth/otp/verify",
    "/auth/refresh",
    "/auth/bootstrap/register",
    "/auth/logout",
    "/auth/mfa/enroll",
    "/auth/mfa/verify-enrollment",
    "/auth/mfa/verify-token",
    "/auth/mfa/recovery-code",
    "/auth/login/mfa-complete",
    "/auth/users",
]);
export function normalizeApiPath(path) {
    const normalized = `/${String(path || "").replace(/^\/+/, "")}`
        .replace(/^\/api(?:\/v1)?(?=\/)/, "")
        .replace(/\/$/, "");
    return normalized || "/";
}
export function isWriteExemptPath(path) {
    return AUTH_WRITE_EXEMPTIONS.has(normalizeApiPath(path));
}
export function canRoleMutate(role) {
    return PRIVILEGED_WRITE_ROLES.includes(role);
}
export async function enforcePrivilegedMutations(req, res, next) {
    if (SAFE_METHODS.has(req.method.toUpperCase()) || isWriteExemptPath(req.path)) {
        return next();
    }
    return authenticateUser(req, res, async () => {
        if (!canRoleMutate(req.user?.role)) {
            await recordAuthFailure(req, "system:mutate", 403);
            return res.status(403).json({
                error: "Read-only account: only Super Admins and EHS Managers can perform actions",
                code: "WRITE_ACCESS_DENIED",
            });
        }
        if (req.user?.id) {
            const mfaEnabled = await mfaService.isMFAEnabled(req.user.id);
            if (!mfaEnabled) {
                await recordAuthFailure(req, "mfa:required", 403);
                return res.status(403).json({
                    error: "MFA is required for privileged roles. Please enable MFA in your profile settings.",
                    code: "MFA_REQUIRED",
                });
            }
        }
        next();
    });
}
