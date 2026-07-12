import { type Response } from "express";
import { PpeService } from "./ppe.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createPpeController(service: PpeService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createPpeRouter(): import("express-serve-static-core").Router;
