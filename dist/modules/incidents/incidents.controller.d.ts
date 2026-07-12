import { type Response } from "express";
import { IncidentsService } from "./incidents.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createIncidentsController(service: IncidentsService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    transition(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
    getOverdue(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createIncidentsRouter(): import("express-serve-static-core").Router;
