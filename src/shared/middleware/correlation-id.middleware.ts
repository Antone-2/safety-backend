import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers["x-request-id"]?.toString() || randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader("x-request-id", correlationId);
  next();
}
