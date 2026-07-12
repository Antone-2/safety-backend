import { Router } from "express";
import { getGoogleDriveDownloadBaseUrl } from "../lib/config.js";
const router = Router();
router.get("/drive/:id", async (req, res) => {
    const id = String(String(String(req.params.id)) ?? "").trim();
    if (!id)
        return res.status(400).json({ error: "missing file id" });
    const driveBaseUrl = getGoogleDriveDownloadBaseUrl();
    if (!driveBaseUrl)
        return res.status(500).json({ error: "Google Drive download base URL is not configured" });
    const driveUrl = `${driveBaseUrl.replace(/\/$/, "")}?export=download&id=${encodeURIComponent(id)}`;
    try {
        const upstream = await fetch(driveUrl, { redirect: "follow" });
        const contentType = upstream.headers.get("content-type") || "application/octet-stream";
        // If the drive response is HTML and contains a sign-in prompt, report a helpful error.
        if (contentType.includes("text/html")) {
            const text = await upstream.text().catch(() => "");
            if (text.toLowerCase().includes("sign in") || text.toLowerCase().includes("accounts.google.com")) {
                return res.status(403).json({ error: "Google Drive file requires authentication or is not shared publicly" });
            }
            res.setHeader("content-type", contentType);
            return res.send(text);
        }
        // Proxy binary image content
        res.setHeader("content-type", contentType);
        const length = upstream.headers.get("content-length");
        if (length)
            res.setHeader("content-length", length);
        const body = upstream.body;
        if (body && typeof body.pipe === "function") {
            return body.pipe(res);
        }
        // Fallback: buffer
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: `Failed to proxy Google Drive file: ${message}` });
    }
});
export default router;
