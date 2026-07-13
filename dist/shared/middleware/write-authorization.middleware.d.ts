import type { NextFunction, Response } from "express";
import { type AuthRequest } from "./auth.middleware.js";
export declare const PRIVILEGED_WRITE_ROLES: readonly ["super-admin", "EHS-manager"];
export declare function normalizeApiPath(path: string): string;
export declare function isWriteExemptPath(path: string): boolean;
export declare function canRoleMutate(role: string | undefined): boolean;
export declare function enforcePrivilegedMutations(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
