import { Request, Response, NextFunction } from "express";
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        iat?: number;
        jti?: string;
    };
}
export declare function authenticateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function requirePermission(permission: string): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare function requireRole(allowedRoles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
