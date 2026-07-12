import { type Response } from "express";
import { ContractorsService } from "./contractors.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createContractorsController(service: ContractorsService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    create(req: AuthRequest, res: Response): Promise<void>;
    update(req: AuthRequest, res: Response): Promise<void>;
    delete(req: AuthRequest, res: Response): Promise<void>;
    recordIncident(req: AuthRequest, res: Response): Promise<void>;
    getIncidents(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createContractorsRouter(): import("express-serve-static-core").Router;
