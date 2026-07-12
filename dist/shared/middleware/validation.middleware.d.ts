import { z } from "zod";
import { Request, Response, NextFunction } from "express";
export declare function validate<T extends z.ZodTypeAny>(schema: T): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
