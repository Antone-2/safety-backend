import { type Response } from "express";
import { FireService } from "./fire.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createFireController(service: FireService): {
    getEquipment(req: AuthRequest, res: Response): Promise<void>;
    getEquipmentById(req: AuthRequest, res: Response): Promise<void>;
    createEquipment(req: AuthRequest, res: Response): Promise<void>;
    updateEquipment(req: AuthRequest, res: Response): Promise<void>;
    deleteEquipment(req: AuthRequest, res: Response): Promise<void>;
    getInspections(req: AuthRequest, res: Response): Promise<void>;
    createInspection(req: AuthRequest, res: Response): Promise<void>;
    getOverdue(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createFireRouter(): import("express-serve-static-core").Router;
