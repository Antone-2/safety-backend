import { type Response } from "express";
import { RiskService } from "./risk.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createRiskController(service: RiskService): {
    getMatrices(_req: AuthRequest, res: Response): Promise<void>;
    createMatrix(req: AuthRequest, res: Response): Promise<void>;
    getRegisters(req: AuthRequest, res: Response): Promise<void>;
    createRegister(req: AuthRequest, res: Response): Promise<void>;
    getRegisterById(req: AuthRequest, res: Response): Promise<void>;
    updateRegister(req: AuthRequest, res: Response): Promise<void>;
    deleteRegister(req: AuthRequest, res: Response): Promise<void>;
    getBowTies(_req: AuthRequest, res: Response): Promise<void>;
    createBowTie(req: AuthRequest, res: Response): Promise<void>;
    getDashboard(_req: AuthRequest, res: Response): Promise<void>;
};
export declare function createRiskRouter(): import("express-serve-static-core").Router;
