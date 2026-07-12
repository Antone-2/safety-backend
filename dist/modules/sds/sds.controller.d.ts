import { type Response } from "express";
import { SdsService } from "./sds.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createSdsController(service: SdsService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    search(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createSdsRouter(): import("express-serve-static-core").Router;
