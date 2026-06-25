function readEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function getGoogleSheetsBaseUrl() {
  return readEnvValue("GOOGLE_SHEETS_API_BASE_URL", "GOOGLE_SHEETS_BASE_URL") || "https://sheets.googleapis.com/v4";
}

export function getGoogleDocsBaseUrl() {
  return readEnvValue("GOOGLE_DOCS_EXPORT_BASE_URL", "GOOGLE_DOCS_BASE_URL") || "https://docs.google.com/spreadsheets/d";
}

export function getPlaceholderImageUrl(label = "placeholder", size = 80) {
  const configured = readEnvValue("GOOGLE_PLACEHOLDER_IMAGE_URL", "PLACEHOLDER_IMAGE_URL");
  if (configured) return configured;

  const safeLabel = encodeURIComponent(label).replace(/%20/g, "+");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
    `<rect width='100%' height='100%' fill='%231e293b'/>` +
    `<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='%23ffffff' font-family='Arial, sans-serif' font-size='16'>${safeLabel}</text>` +
    `</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
