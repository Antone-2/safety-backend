import { randomUUID } from "crypto";
export function correlationIdMiddleware(req, res, next) {
    const correlationId = req.headers["x-request-id"]?.toString() || randomUUID();
    req.correlationId = correlationId;
    res.setHeader("x-request-id", correlationId);
    next();
}
