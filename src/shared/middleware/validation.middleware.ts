import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = z.object({ body: schema }).safeParse({ body: req.body });
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid request data",
          details: result.error.errors,
        },
      });
    }

    req.body = result.data.body;
    next();
  };
}
