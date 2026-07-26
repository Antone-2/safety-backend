import { type Response } from "express";
import { StatutoryAuditService } from "./statutory-audits.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createStatutoryAuditController(service: StatutoryAuditService): {
    getMatrix(req: AuthRequest, res: Response): Promise<void>;
    upsertRecord(req: AuthRequest, res: Response): Promise<void>;
    deleteLocation(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createStatutoryAuditRouter(): import("express-serve-static-core").Router;
