export function requestIdMiddleware(req, res, next) {
    const existing = req.get("x-request-id") || req.get("x-correlation-id");
    const requestId = existing || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
}
