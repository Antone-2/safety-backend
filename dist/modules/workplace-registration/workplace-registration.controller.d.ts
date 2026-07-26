import { type Response } from "express";
import { WorkplaceRegistrationService } from "./workplace-registration.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createWorkplaceRegistrationController(service: WorkplaceRegistrationService): {
    getRegistrations(_req: AuthRequest, res: Response): Promise<void>;
    getRegistrationById(req: AuthRequest, res: Response): Promise<void>;
    getStats(_req: AuthRequest, res: Response): Promise<void>;
    createRegistration(req: AuthRequest, res: Response): Promise<void>;
    updateRegistration(req: AuthRequest, res: Response): Promise<void>;
    deleteRegistration(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createWorkplaceRegistrationRouter(): import("express-serve-static-core").Router;
