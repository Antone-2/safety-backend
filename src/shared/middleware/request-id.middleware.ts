import type { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = req.get("x-request-id") || req.get("x-correlation-id");
  const requestId = existing || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
