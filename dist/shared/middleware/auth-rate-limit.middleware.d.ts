import { Request, Response, NextFunction } from "express";
export declare function authRateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function recordAuthFailure(req: Request): Promise<void>;
export declare function clearAuthRateLimit(email: string): void;
