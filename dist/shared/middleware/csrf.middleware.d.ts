import type { NextFunction, Request, Response } from "express";
export declare function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
