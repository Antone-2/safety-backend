import { type Response } from "express";
import { KpiService } from "./kpi.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createKpiController(service: KpiService): {
    getDefinitions(req: AuthRequest, res: Response): Promise<void>;
    getDefinition(req: AuthRequest, res: Response): Promise<void>;
    createDefinition(req: AuthRequest, res: Response): Promise<void>;
    updateDefinition(req: AuthRequest, res: Response): Promise<void>;
    deleteDefinition(req: AuthRequest, res: Response): Promise<void>;
    getValues(req: AuthRequest, res: Response): Promise<void>;
    getValue(req: AuthRequest, res: Response): Promise<void>;
    createValue(req: AuthRequest, res: Response): Promise<void>;
    updateValue(req: AuthRequest, res: Response): Promise<void>;
    deleteValue(req: AuthRequest, res: Response): Promise<void>;
    getDashboard(_req: AuthRequest, res: Response): Promise<void>;
};
export declare function createKpiRouter(): import("express-serve-static-core").Router;
