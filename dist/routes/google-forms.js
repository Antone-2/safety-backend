import { Router } from "express";
import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { REPORT_SOURCE_GOOGLE_SHEETS } from "../lib/types.js";
import { broadcastReport } from "./reports.js";
import { getGoogleDocsBaseUrl, getGoogleSheetsBaseUrl, getPlaceholderImageUrl } from "../lib/config.js";
const router = Router();
function parseCsvText(text) {
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            row.push(current);
            current = "";
            continue;
        }
        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n')
                i += 1;
            row.push(current);
            if (row.some((cell) => cell.trim().length > 0)) {
                rows.push(row);
            }
            row = [];
            current = "";
            continue;
        }
        current += char;
    }
    if (current.length > 0 || row.length > 0) {
        row.push(current);
        if (row.some((cell) => cell.trim().length > 0)) {
            rows.push(row);
        }
    }
    return rows;
}
function getSheetCandidates(requestedSheetName) {
    const candidates = [
        requestedSheetName,
        process.env.GOOGLE_SHEET_NAME,
        "Form Responses 1",
        "Unsafe Acts/ Conditions (Responses)",
        "Responses",
        "Sheet1",
    ].filter((value) => Boolean(value && value.trim()));
    const uniqueCandidates = [];
    const seen = new Set();
    for (const candidate of candidates) {
        const normalized = candidate.trim();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            uniqueCandidates.push(normalized);
        }
    }
    return uniqueCandidates;
}
export async function fetchGoogleSheetRows(formId, apiKey, requestedSheetName) {
    const candidates = getSheetCandidates(requestedSheetName);
    let lastError;
    for (const sheetName of candidates) {
        const apiBaseUrl = getGoogleSheetsBaseUrl().replace(/\/$/, "");
        const apiUrl = `${apiBaseUrl}/spreadsheets/${formId}/values/${encodeURIComponent(sheetName)}!A:ZZ?key=${apiKey}`;
        try {
            const apiResponse = await fetch(apiUrl);
            if (apiResponse.ok) {
                const data = (await apiResponse.json());
                return { rows: data.values || [], sheetName };
            }
            const body = await apiResponse.text();
            lastError = new Error(`Google Sheets API error: ${apiResponse.status} ${apiResponse.statusText} (body: ${body.slice(0, 500)})`);
        }
        catch (error) {
            lastError = error;
        }
    }
    try {
        const docsBaseUrl = getGoogleDocsBaseUrl().replace(/\/$/, "");
        const csvUrl = `${docsBaseUrl}/${formId}/export?format=csv`;
        const csvResponse = await fetch(csvUrl);
        if (csvResponse.ok) {
            const csvText = await csvResponse.text();
            return { rows: parseCsvText(csvText), sheetName: candidates[0] || "Sheet1" };
        }
    }
    catch (error) {
        lastError = error;
    }
    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error("Unable to read Google Sheet responses");
}
function getDefaults() {
    return {
        locations: [
            "Mogadishu - Factory", "Nakuru - Depot", "Sinai - Export Warehouse",
            "Likoni - Head Office & Warehouse", "Mombasa - Factory",
        ],
        categories: ["Slip / Trip", "Chemical Spill", "PPE Violation", "Electrical", "Falling Object", "Vehicle / Forklift", "Inhalation / Fumes", "Fire / Ignition", "Manual Handling", "Noise Exposure"],
        departments: ["Production", "Warehouse", "Maintenance", "QA", "Logistics"],
    };
}
function normalizeSeverity(sev) {
    const s = (sev || "").toLowerCase().trim();
    if (s.includes("critical"))
        return "Critical";
    if (s.includes("high"))
        return "High";
    if (s.includes("medium"))
        return "Medium";
    return "Low";
}
function normalizeType(type) {
    const t = (type || "").toLowerCase().trim();
    if (t.includes("condition"))
        return "Unsafe Condition";
    return "Unsafe Act";
}
function normalizeStatus(status) {
    const s = (status || "").toString().trim().toLowerCase();
    if (s.includes("progress"))
        return "In Progress";
    if (s.includes("closed") || s.includes("complete") || s.includes("resolved"))
        return "Closed";
    return "Open";
}
function parseDate(dateStr) {
    if (!dateStr)
        return new Date().toISOString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function normalizeHeaderKey(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/^\d+[.)]\s*/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function buildHeaderLookup(headers) {
    const lookup = {};
    headers.forEach((header, index) => {
        const normalized = normalizeHeaderKey(header);
        if (normalized)
            lookup[normalized] = index;
    });
    return lookup;
}
function normalizeImportedValue(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");
}
export function replaceGoogleSheetReportsInSqlite(db, reports) {
    db.prepare("DELETE FROM reports WHERE source = ?").run([REPORT_SOURCE_GOOGLE_SHEETS]);
    for (const report of reports) {
        db.prepare(`INSERT INTO reports (id, date, location, reporter, description, severity, status, category, type, slaHours, dueAt, isNearMiss, anonymous, department, shift, complianceRequired, photoUrl, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run([
            report.id,
            report.date,
            report.location,
            report.reporter,
            report.description,
            report.severity,
            report.status,
            report.category,
            report.type,
            report.slaHours,
            report.dueAt,
            0,
            report.anonymous ? 1 : 0,
            report.department,
            report.shift,
            report.complianceRequired ? 1 : 0,
            report.photoUrl,
            REPORT_SOURCE_GOOGLE_SHEETS,
        ]);
    }
}
export function buildReportIdForImportedRecord(imported) {
    const rowKey = [
        normalizeImportedValue(imported.date),
        normalizeImportedValue(imported.location),
        normalizeImportedValue(imported.reporter),
        normalizeImportedValue(imported.description),
        normalizeImportedValue(imported.category),
        normalizeImportedValue(imported.type),
        normalizeImportedValue(imported.severity),
    ].join("::");
    let hash = 0x811c9dc5;
    for (let i = 0; i < rowKey.length; i += 1) {
        hash ^= rowKey.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    const stableIdHash = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return `RPT-${stableIdHash}`;
}
function getMatchingCell(headers, row, aliases, fallbackIndex) {
    const lookup = buildHeaderLookup(headers);
    const normalizedAliases = aliases.map(normalizeHeaderKey).filter(Boolean);
    for (const alias of normalizedAliases) {
        const headerIndex = lookup[alias];
        if (typeof headerIndex === "number") {
            const value = row[headerIndex];
            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }
    }
    for (const [index, header] of headers.entries()) {
        const normalizedHeader = normalizeHeaderKey(header);
        if (!normalizedHeader)
            continue;
        for (const alias of normalizedAliases) {
            if (normalizedHeader === alias || normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
                const value = row[index];
                if (typeof value === "string" && value.trim()) {
                    return value.trim();
                }
            }
        }
    }
    if (typeof fallbackIndex === "number" && row[fallbackIndex] !== undefined) {
        return String(row[fallbackIndex] ?? "").trim();
    }
    return "";
}
export function buildReportRecordFromRow(headers, row, defaults) {
    const location = getMatchingCell(headers, row, ["location", "site", "branch", "facility", "plant", "warehouse", "office"], 1) || defaults.locations[0];
    const reporter = getMatchingCell(headers, row, ["reporter", "reporter name", "submitted by", "submitted by name", "name", "your name", "full name", "person reporting"], 2) || "Anonymous";
    const categoryRaw = getMatchingCell(headers, row, ["category", "hazard", "incident type", "incident category", "hazard category", "type of incident"], 4) || defaults.categories[0];
    const typeRaw = getMatchingCell(headers, row, ["type", "nature", "report type", "unsafe act condition", "unsafe act condition", "incident type"], 4) || "Unsafe Condition";
    const type = typeRaw.toLowerCase().includes("condition") ? "Unsafe Condition" : "Unsafe Act";
    const description = getMatchingCell(headers, row, ["description", "incident", "incident description", "details", "brief description", "hazard description", "summary", "incident summary", "details of the hazard", "briefly details"], 8) || "";
    const dateRaw = getMatchingCell(headers, row, ["timestamp", "date", "date submitted", "created at", "submitted at"], 0);
    const date = parseDate(dateRaw);
    const severity = normalizeSeverity(getMatchingCell(headers, row, ["severity", "risk level", "severity level", "priority", "impact"], 7) || "Medium");
    const status = normalizeStatus(getMatchingCell(headers, row, ["status", "report status", "current status", "ticket status"], 0) || "Open");
    const anonymous = reporter.toLowerCase() === "anonymous";
    const slaHours = severity === "Critical" ? 24 : severity === "High" ? 72 : 168;
    const dueAt = new Date(new Date(date).getTime() + slaHours * 3600000).toISOString();
    const photoUrl = getMatchingCell(headers, row, ["photo", "photo url", "image", "image url"], 0) || "";
    const department = defaults.departments[0];
    const shift = "Day";
    const complianceRequired = severity === "Critical" || severity === "High";
    return {
        date,
        location,
        reporter: anonymous ? "Anonymous" : reporter,
        description,
        severity,
        status,
        category: categoryRaw,
        type,
        anonymous,
        photoUrl,
        department,
        shift,
        slaHours,
        dueAt,
        complianceRequired,
    };
}
export function classifyGoogleFormsError(error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    // Node fetch errors often carry `cause` with code/hostname; be defensive.
    const cause = error?.cause;
    const code = cause?.code ?? error?.code;
    const hostname = cause?.hostname ?? error?.hostname;
    const stack = error instanceof Error ? error.stack : undefined;
    // Network/DNS timeouts
    if (code === "ENOTFOUND" ||
        /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|fetch failed|timed out/i.test(message)) {
        const hostDetails = hostname ? ` for ${hostname}` : "";
        return {
            statusCode: 502,
            message: "Unable to reach Google Sheets from the server right now.",
            details: code === "ENOTFOUND"
                ? `DNS lookup failed${hostDetails}`
                : `Network error${hostDetails}: ${message}`,
            hint: "Check network connectivity, firewall, and Google Sheets access settings.",
        };
    }
    // Permission denied (403 Forbidden)
    if (/403 Forbidden|permission denied|access denied/i.test(message)) {
        return {
            statusCode: 403,
            message: "Permission denied accessing Google Sheet.",
            details: stack ? `${message} (stack: ${stack.slice(0, 600)})` : message,
            hint: "Make the spreadsheet shareable (anyone with link can view) and verify the API key has Sheets API enabled.",
        };
    }
    // Generic/unknown failures (bad key, bad spreadsheet, wrong sheet name, etc.)
    return {
        statusCode: 500,
        message: "Google Sheets request failed.",
        details: stack ? `${message} (stack: ${stack.slice(0, 600)})` : message,
        hint: "Check the spreadsheet ID, API key, and which Sheets/CSV base URLs are configured.",
    };
}
router.post("/import", async (req, res) => {
    const body = req.body ?? {};
    const { spreadsheetId, apiKey } = body;
    if (!spreadsheetId)
        return res.status(400).json({ error: "spreadsheetId is required" });
    const effectiveApiKey = apiKey || process.env.GOOGLE_API_KEY;
    if (!effectiveApiKey)
        return res.status(400).json({ error: "Google API key required" });
    try {
        const { rows } = await fetchGoogleSheetRows(spreadsheetId, effectiveApiKey, "Form Responses 1");
        if (rows.length < 2)
            return res.json({ imported: 0, message: "No data found or only header row exists" });
        const headers = rows[0];
        const dataRows = rows.slice(1);
        const defaults = getDefaults();
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            for (const row of dataRows) {
                const imported = buildReportRecordFromRow(headers, row, defaults);
                const id = buildReportIdForImportedRecord(imported);
                const photoUrl = imported.photoUrl.trim() || getPlaceholderImageUrl(id.slice(-3), 80);
                await db.collection("reports").doc(id).set({
                    id,
                    source: REPORT_SOURCE_GOOGLE_SHEETS,
                    date: imported.date,
                    location: imported.location,
                    reporter: imported.reporter,
                    description: imported.description,
                    severity: imported.severity,
                    status: imported.status,
                    category: imported.category,
                    type: imported.type,
                    slaHours: imported.slaHours,
                    dueAt: imported.dueAt,
                    isNearMiss: false,
                    anonymous: imported.anonymous ? 1 : 0,
                    department: imported.department,
                    shift: imported.shift,
                    complianceRequired: imported.complianceRequired ? 1 : 0,
                    photoUrl,
                    comments: [],
                });
            }
            return res.json({ imported: dataRows.length, skipped: 0, message: `Imported ${dataRows.length} reports` });
        }
        const db = await getDb();
        const importedReports = [];
        for (const row of dataRows) {
            const imported = buildReportRecordFromRow(headers, row, defaults);
            const id = buildReportIdForImportedRecord(imported);
            const photoUrl = imported.photoUrl.trim() || getPlaceholderImageUrl(id.slice(-3), 80);
            importedReports.push({
                id,
                date: imported.date,
                location: imported.location,
                reporter: imported.reporter,
                description: imported.description,
                severity: imported.severity,
                status: imported.status,
                category: imported.category,
                type: imported.type,
                slaHours: imported.slaHours,
                dueAt: imported.dueAt,
                anonymous: imported.anonymous,
                department: imported.department,
                shift: imported.shift,
                complianceRequired: imported.complianceRequired,
                photoUrl,
            });
        }
        replaceGoogleSheetReportsInSqlite(db, importedReports);
        await saveDb(db);
        return res.json({ imported: dataRows.length, skipped: 0, message: `Imported ${dataRows.length} reports` });
    }
    catch (error) {
        const classified = classifyGoogleFormsError(error);
        res.status(classified.statusCode).json({
            error: classified.message,
            details: classified.details,
            hint: classified.hint,
        });
    }
});
router.get("/status", async (_req, res) => {
    const formId = process.env.GOOGLE_FORM_ID;
    const hasCreds = Boolean(process.env.CLIENT_ID && process.env.CLIENT_SECRET);
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const reportsSnap = await db.collection("reports").get();
        const total = reportsSnap.size;
        return res.json({ totalReports: total, configured: hasCreds, formId, hasCredentials: hasCreds });
    }
    const db = await getDb();
    const total = allRows(db, "SELECT COUNT(*) as count FROM reports WHERE source = ?", [REPORT_SOURCE_GOOGLE_SHEETS])[0]?.count || 0;
    res.json({ totalReports: total, configured: hasCreds, formId, hasCredentials: hasCreds });
});
router.post("/fetch", async (req, res) => {
    const body = req.body ?? {};
    const formId = body.spreadsheetId || process.env.GOOGLE_FORM_ID;
    const apiKey = body.apiKey || process.env.GOOGLE_API_KEY;
    const sheetName = body.sheetName || "Unsafe Acts/ Conditions (Responses)";
    if (!formId)
        return res.status(400).json({ error: "Google Form ID not configured" });
    if (!apiKey)
        return res.status(400).json({ error: "Google API key required" });
    let rows = [];
    try {
        const fetched = await fetchGoogleSheetRows(formId, apiKey, sheetName);
        rows = fetched.rows;
        if (rows.length < 2)
            return res.json({ imported: 0, responses: [], message: "No data found in Google Form responses" });
        const headers = rows[0];
        const dataRows = rows.slice(1);
        const defaults = getDefaults();
        let importedCount = 0;
        const dbForSqlite = isFirebaseAvailable() ? null : await getDb();
        const newReports = [];
        for (const row of dataRows) {
            const imported = buildReportRecordFromRow(headers, row, defaults);
            const id = buildReportIdForImportedRecord(imported);
            const photoUrl = imported.photoUrl.trim() || getPlaceholderImageUrl(id.slice(-3), 80);
            const newReport = {
                id,
                source: REPORT_SOURCE_GOOGLE_SHEETS,
                date: imported.date,
                location: imported.location,
                reporter: imported.reporter,
                description: imported.description,
                severity: imported.severity,
                status: imported.status,
                category: imported.category,
                type: imported.type,
                slaHours: imported.slaHours,
                dueAt: imported.dueAt,
                isNearMiss: false,
                anonymous: imported.anonymous ? 1 : 0,
                department: imported.department,
                shift: imported.shift,
                complianceRequired: imported.complianceRequired ? 1 : 0,
                photoUrl,
                comments: [],
            };
            if (isFirebaseAvailable()) {
                const db = getFirebase();
                await db.collection("reports").doc(id).set(newReport);
                broadcastReport(newReport);
            }
            else if (dbForSqlite) {
                newReports.push({
                    id,
                    date: imported.date,
                    location: imported.location,
                    reporter: imported.reporter,
                    description: imported.description,
                    severity: imported.severity,
                    status: imported.status,
                    category: imported.category,
                    type: imported.type,
                    slaHours: imported.slaHours,
                    dueAt: imported.dueAt,
                    anonymous: imported.anonymous,
                    department: imported.department,
                    shift: imported.shift,
                    complianceRequired: imported.complianceRequired,
                    photoUrl,
                });
                broadcastReport({
                    ...newReport,
                    anonymous: imported.anonymous,
                    complianceRequired: imported.complianceRequired,
                });
            }
            importedCount++;
        }
        if (dbForSqlite && newReports.length > 0) {
            replaceGoogleSheetReportsInSqlite(dbForSqlite, newReports);
        }
        // Update sync timestamp
        const maxTimestamp = dataRows.reduce((max, row) => {
            const ts = row[0] || "";
            return ts && (!max || ts > max) ? ts : max;
        }, "");
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            await db.collection("syncMeta").doc("googleForms").set({ lastTimestamp: maxTimestamp, lastSync: new Date().toISOString() });
        }
        else if (maxTimestamp && dbForSqlite) {
            dbForSqlite.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('google_forms_sync', ?)").run([JSON.stringify({ lastTimestamp: maxTimestamp, lastSync: new Date().toISOString() })]);
            await saveDb(dbForSqlite);
        }
        const responses = dataRows.map((row) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] || ""; });
            return obj;
        });
        return res.json({ imported: importedCount, responses, message: `Imported ${importedCount} new reports from Google Form ${formId}` });
    }
    catch (error) {
        const classified = classifyGoogleFormsError(error);
        console.error("Google Forms fetch error:", {
            classified,
            formId,
            sheetName,
            apiBaseUrl: getGoogleSheetsBaseUrl(),
            docsBaseUrl: getGoogleDocsBaseUrl(),
            // Avoid leaking secrets
            hasApiKey: Boolean(apiKey),
        });
        res.status(classified.statusCode).json({
            error: classified.message,
            details: classified.details,
            hint: classified.hint,
            meta: {
                formId,
                sheetName,
                apiBaseUrl: getGoogleSheetsBaseUrl(),
                docsBaseUrl: getGoogleDocsBaseUrl(),
                hasApiKey: Boolean(apiKey),
            },
        });
    }
});
export default router;
