import { type Response } from "express";
import { ScaffoldService } from "./scaffolding.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createScaffoldController(service: ScaffoldService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createScaffoldRouter(): import("express-serve-static-core").Router;
