import { type Response } from "express";
import { EquipmentService } from "./equipment.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createEquipmentController(service: EquipmentService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    getInspections(req: AuthRequest, res: Response): Promise<void>;
    createInspection(req: AuthRequest, res: Response): Promise<void>;
    getOverdue(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createEquipmentRouter(): import("express-serve-static-core").Router;
