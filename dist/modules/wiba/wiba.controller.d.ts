import { type Response } from "express";
import { WibaService } from "./wiba.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createWibaController(service: WibaService): {
    getClaims(_req: AuthRequest, res: Response): Promise<void>;
    createClaim(req: AuthRequest, res: Response): Promise<void>;
    updateClaim(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createWibaRouter(): import("express-serve-static-core").Router;
