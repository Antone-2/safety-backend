import "dotenv/config";
import { z } from "zod";
import { EnvSchema, type Env } from "./env.schema.js";

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  try {
    cachedEnv = EnvSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment configuration:", error.errors);
      process.exit(1);
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}
