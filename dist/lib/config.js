function readEnvValue(...keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return "";
}
// Default to the public Google Sheets API v4 endpoint when no base URL is
// configured. Without this, the sync silently fails because the request URL
// becomes relative/empty.
export function getGoogleSheetsBaseUrl() {
    return (readEnvValue("GOOGLE_SHEETS_API_BASE_URL", "GOOGLE_SHEETS_BASE_URL", "GOOGLE_SHEETS_FALLBACK_URL") ||
        "https://sheets.googleapis.com/v4");
}
export function getGoogleDocsBaseUrl() {
    return (readEnvValue("GOOGLE_DOCS_EXPORT_BASE_URL", "GOOGLE_DOCS_BASE_URL", "GOOGLE_DOCS_FALLBACK_URL") ||
        "https://docs.google.com/spreadsheets/d");
}
export function getGoogleDriveDownloadBaseUrl() {
    return readEnvValue("GOOGLE_DRIVE_DOWNLOAD_BASE_URL", "GOOGLE_DRIVE_BASE_URL");
}
export function getPlaceholderImageUrl(label = "placeholder", size = 80) {
    const configured = readEnvValue("GOOGLE_PLACEHOLDER_IMAGE_URL", "PLACEHOLDER_IMAGE_URL");
    if (configured && (!configured.startsWith("data:") || configured.includes(",")))
        return configured;
    const safeSize = Number.isFinite(size) && size > 0 ? Math.min(Math.round(size), 512) : 80;
    const safeLabel = String(label || "placeholder")
        .slice(0, 24)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 ${safeSize} ${safeSize}">` +
        `<rect width="100%" height="100%" fill="#1e293b"/>` +
        `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="16">${safeLabel}</text>` +
        `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
