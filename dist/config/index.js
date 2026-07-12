import "dotenv/config";
import { z } from "zod";
import { EnvSchema } from "./env.schema.js";
let cachedEnv = null;
export function loadEnv() {
    if (cachedEnv)
        return cachedEnv;
    try {
        cachedEnv = EnvSchema.parse(process.env);
        return cachedEnv;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            console.error("Invalid environment configuration:", error.errors);
            process.exit(1);
        }
        throw error;
    }
}
export function getEnv() {
    if (!cachedEnv) {
        return loadEnv();
    }
    return cachedEnv;
}
