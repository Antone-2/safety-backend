import { type Response } from "express";
import { EnvironmentalService } from "./environmental.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createEnvironmentalController(service: EnvironmentalService): {
    getWaste(req: AuthRequest, res: Response): Promise<void>;
    createWaste(req: AuthRequest, res: Response): Promise<void>;
    updateWaste(req: AuthRequest, res: Response): Promise<void>;
    getEmissions(req: AuthRequest, res: Response): Promise<void>;
    createEmission(req: AuthRequest, res: Response): Promise<void>;
    updateEmission(req: AuthRequest, res: Response): Promise<void>;
    getChemicals(req: AuthRequest, res: Response): Promise<void>;
    createChemical(req: AuthRequest, res: Response): Promise<void>;
    updateChemical(req: AuthRequest, res: Response): Promise<void>;
    getSpills(req: AuthRequest, res: Response): Promise<void>;
    createSpill(req: AuthRequest, res: Response): Promise<void>;
    updateSpill(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createEnvironmentalRouter(): import("express-serve-static-core").Router;
