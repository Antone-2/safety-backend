import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { logger } from "../utils/logger.js";
import type { AuthRequest } from "./auth.middleware.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
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
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(422, "BUSINESS_RULE_VIOLATION", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, "RATE_LIMIT_EXCEEDED", message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(502, "EXTERNAL_SERVICE_ERROR", message || `${service} is unavailable`);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = (req as any).correlationId || "unknown";
  const maybeBodyParserError = err as Error & {
    status?: number;
    statusCode?: number;
    type?: string;
    body?: unknown;
  };

  if (
    err instanceof SyntaxError &&
    (maybeBodyParserError.status === 400 || maybeBodyParserError.statusCode === 400) &&
    maybeBodyParserError.type === "entity.parse.failed"
  ) {
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
