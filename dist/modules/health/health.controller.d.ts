import { type Response } from "express";
import { HealthService } from "./health.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createHealthController(service: HealthService): {
    getRecords(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    getExpiring(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createHealthRouter(): import("express-serve-static-core").Router;
