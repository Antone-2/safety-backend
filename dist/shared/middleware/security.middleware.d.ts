import type { NextFunction, Request, Response } from "express";
export declare function buildSecurityHeaders(): Record<string, string>;
export declare function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void;
