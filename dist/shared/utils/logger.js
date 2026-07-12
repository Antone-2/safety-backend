import pino from "pino";
import { getEnv } from "../../config/index.js";
const env = getEnv();
export const logger = pino({
    level: env.LOG_LEVEL || (env.NODE_ENV === "production" ? "info" : "debug"),
    redact: ["password", "token", "authorization", "cookie", "secret"],
    formatters: {
        log: (log) => {
            return {
                ...log,
                service: "safety-backend",
                version: "2.0.0",
                env: env.NODE_ENV,
            };
        },
    },
});
