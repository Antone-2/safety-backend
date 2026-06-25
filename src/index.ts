import express from "express";
import cors from "cors";
import "dotenv/config";
import { initFirebase } from "./lib/firebase.js";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),
  DATABASE_PATH: z.string().optional(),
});

const validatedEnv: z.infer<typeof EnvSchema> = (() => {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment configuration:", error.errors);
      process.exit(1);
    }
    throw error;
  }
})();

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;

  const configuredOrigins = (validatedEnv.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) return true;

  return /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin);
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const windowMs = validatedEnv.NODE_ENV === "production" ? 15 * 60 * 1000 : 5 * 60 * 1000;
  const maxRequests = validatedEnv.NODE_ENV === "production" ? 100 : 1000;

  const record = rateLimitMap.get(key);

  if (!record || now >= record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  record.count += 1;

  if (record.count > maxRequests) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  next();
}

function requestTimeoutMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
}

import reportsRouter from "./routes/reports.js";
import capaRouter from "./routes/capa.js";
import settingsRouter from "./routes/settings.js";
import referenceRouter from "./routes/reference.js";
import googleFormsRouter from "./routes/google-forms.js";
import authRouter from "./routes/auth.js";
import notificationsRouter from "./routes/notifications.js";

initFirebase();

const app = express();

app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (validatedEnv.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(rateLimitMiddleware);
app.use(requestTimeoutMiddleware);

app.use("/api/reports", reportsRouter);
app.use("/api/capa", capaRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reference", referenceRouter);
app.use("/api/google-forms", googleFormsRouter);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationsRouter);

app.get("/health", (_req, res) => res.json({ ok: true, env: validatedEnv.NODE_ENV }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = validatedEnv.PORT;
const server = app.listen(PORT, () => console.log(`HSE Backend running on http://localhost:${PORT}`));

function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown due to timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
