import { type Response } from "express";
import { TrainingService } from "./training.service.js";
import { type AuthRequest } from "../../shared/middleware/auth.middleware.js";
export declare function createTrainingController(service: TrainingService): {
    getAll(req: AuthRequest, res: Response): Promise<void>;
    getById(req: AuthRequest, res: Response): Promise<void>;
    createCourse(req: AuthRequest, res: Response): Promise<void>;
    updateCourse(req: AuthRequest, res: Response): Promise<void>;
    deleteCourse(req: AuthRequest, res: Response): Promise<void>;
    getRecords(req: AuthRequest, res: Response): Promise<void>;
    getRecordById(req: AuthRequest, res: Response): Promise<void>;
    createRecord(req: AuthRequest, res: Response): Promise<void>;
    updateRecord(req: AuthRequest, res: Response): Promise<void>;
    deleteRecord(req: AuthRequest, res: Response): Promise<void>;
    getMatrix(req: AuthRequest, res: Response): Promise<void>;
    createMatrix(req: AuthRequest, res: Response): Promise<void>;
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export declare function createTrainingRouter(): import("express-serve-static-core").Router;
