import { type Request, type Response, type NextFunction } from "express";
declare const router: import("express-serve-static-core").Router;
declare function authMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(...allowedRoles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export { authMiddleware };
export default router;
