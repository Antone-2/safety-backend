import express from "express";
import cors from "cors";
import "dotenv/config";
import { initFirebase } from "./lib/firebase.js";
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    const configuredOrigins = (process.env.FRONTEND_URL || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (configuredOrigins.includes(origin))
        return true;
    return /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin);
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
app.use("/api/reports", reportsRouter);
app.use("/api/capa", capaRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reference", referenceRouter);
app.use("/api/google-forms", googleFormsRouter);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationsRouter);
app.get("/health", (_req, res) => res.json({ ok: true }));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`HSE Backend running on http://localhost:${PORT}`));
