import { z } from "zod";
import { logger } from "../utils/logger.js";
export class AppError extends Error {
    statusCode;
    code;
    isOperational;
    constructor(statusCode, code, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends AppError {
    constructor(message) {
        super(400, "VALIDATION_FAILED", message);
    }
}
export class AuthenticationError extends AppError {
    constructor(message = "Unauthorized") {
        super(401, "AUTHENTICATION_FAILED", message);
    }
}
export class AuthorizationError extends AppError {
    constructor(message = "Forbidden") {
        super(403, "AUTHORIZATION_FAILED", message);
    }
}
export class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(404, "NOT_FOUND", `${resource} not found`);
    }
}
export class ConflictError extends AppError {
    constructor(message) {
        super(409, "CONFLICT", message);
    }
}
export class BusinessRuleError extends AppError {
    constructor(message) {
        super(422, "BUSINESS_RULE_VIOLATION", message);
    }
}
export class RateLimitError extends AppError {
    constructor(message = "Too many requests") {
        super(429, "RATE_LIMIT_EXCEEDED", message);
    }
}
export class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(502, "EXTERNAL_SERVICE_ERROR", message || `${service} is unavailable`);
    }
}
export function errorHandler(err, req, res, next) {
    const requestId = req.correlationId || "unknown";
    const maybeBodyParserError = err;
    if (err instanceof SyntaxError &&
        (maybeBodyParserError.status === 400 || maybeBodyParserError.statusCode === 400) &&
        maybeBodyParserError.type === "entity.parse.failed") {
        logger.warn({
            requestId,
            code: "INVALID_JSON",
            message: err.message,
            method: req.method,
            path: req.path,
        });
        return res.status(400).json({
            error: {
                code: "INVALID_JSON",
                message: "Invalid JSON body. Check request formatting and quoting.",
                requestId,
            },
        });
    }
    if (err instanceof AppError) {
        logger.warn({ requestId, code: err.code, message: err.message, stack: err.stack });
        return res.status(err.statusCode).json({
            error: { code: err.code, message: err.message, requestId },
        });
    }
    if (err instanceof z.ZodError) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_FAILED",
                message: "Invalid request data",
                details: err.errors,
                requestId,
            },
        });
    }
    logger.error({ requestId, message: err.message, stack: err.stack });
    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
            requestId,
        },
    });
}
