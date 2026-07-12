import { type Response } from "express";
import { PermitsService } from "./permits.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createPermitsController(service: PermitsService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    advanceStatus(req: AuthRequest, res: Response): Promise<void>;
    getActive(req: AuthRequest, res: Response): Promise<void>;
    getExpired(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createPermitsRouter(): import("express-serve-static-core").Router;
