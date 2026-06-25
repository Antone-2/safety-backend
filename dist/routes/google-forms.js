import { Router } from "express";
import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { broadcastReport } from "./reports.js";
import { authMiddleware, requireRole } from "./auth.js";
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
async function fetchGoogleSheetRows(formId, apiKey, requestedSheetName) {
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
            lastError = new Error(`Google Sheets API error: ${apiResponse.status} ${apiResponse.statusText}`);
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
export function classifyGoogleFormsError(error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    const cause = error?.cause;
    const code = cause?.code ?? error?.code;
    const hostname = cause?.hostname ?? error?.hostname;
    if (code === "ENOTFOUND" || /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|fetch failed/i.test(message)) {
        const hostDetails = hostname ? ` for ${hostname}` : "";
        return {
            statusCode: 502,
            message: "Unable to reach Google Sheets from the server right now.",
            details: code === "ENOTFOUND"
                ? `DNS lookup failed${hostDetails}`
                : `Network error${hostDetails}: ${message}`,
            hint: "Check network connectivity or Google Sheets access settings.",
        };
    }
    return {
        statusCode: 500,
        message: "Google Sheets request failed.",
        details: message,
        hint: "Check the spreadsheet ID, API key, and network connectivity.",
    };
}
router.post("/import", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req, res) => {
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
        // Normalize headers because Google Sheets exports can contain extra whitespace.
        const normalizeHeader = (h) => h.trim().replace(/\s+/g, " ");
        const normalizedHeaders = headers.map(normalizeHeader);
        // Fast lookup to map normalized header name -> column index.
        const headerIndex = {};
        for (let i = 0; i < normalizedHeaders.length; i++) {
            headerIndex[normalizedHeaders[i]] = i;
        }
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            for (const row of dataRows) {
                const rowObj = headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] }), {});
                const location = rowObj.Location || rowObj["Site"] || rowObj["Branch"] || "";
                const description = rowObj.Description || rowObj["Incident"] || "";
                const severity = normalizeSeverity(rowObj.Severity || rowObj["Risk Level"]);
                const category = rowObj.Category || rowObj["Hazard"] || rowObj["Incident Type"] || "";
                const type = normalizeType(rowObj.Type || rowObj["Nature"]);
                const reporter = rowObj.Reporter || rowObj["Submitted By"] || "Anonymous";
                const anonymous = (rowObj.Anonymous || "").toString().toLowerCase() === "true" || reporter.toLowerCase() === "anonymous";
                const date = parseDate(rowObj.Timestamp || rowObj.Date);
                const slaHours = severity === "Critical" ? 24 : severity === "High" ? 72 : 168;
                const dueDate = new Date(new Date(date).getTime() + slaHours * 3600000).toISOString();
                const id = `RPT-${uuidv4().slice(0, 8).toUpperCase()}`;
                const status = normalizeStatus(rowObj.Status || rowObj["Report Status"] || rowObj["Current Status"] || rowObj["Ticket Status"] || "Open");
                const photoUrl = (rowObj.Photo || rowObj["Photo URL"] || rowObj.Image || rowObj["Image URL"] || "").toString().trim() || getPlaceholderImageUrl(id.slice(-3), 80);
                await db.collection("reports").doc(id).set({
                    id, date, location, reporter: anonymous ? "Anonymous" : reporter,
                    description, severity, status, category, type, slaHours, dueAt: dueDate,
                    isNearMiss: false, anonymous: anonymous ? 1 : 0, department: "Production", shift: "Day",
                    complianceRequired: severity === "Critical" || severity === "High" ? 1 : 0,
                    photoUrl, comments: [],
                });
            }
            return res.json({ imported: dataRows.length, skipped: 0, message: `Imported ${dataRows.length} reports` });
        }
        const db = await getDb();
        for (const row of dataRows) {
            const rowObj = headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] }), {});
            const location = rowObj.Location || rowObj["Site"] || rowObj["Branch"] || "";
            const description = rowObj.Description || rowObj["Incident"] || "";
            const severity = normalizeSeverity(rowObj.Severity || rowObj["Risk Level"]);
            const category = rowObj.Category || rowObj["Hazard"] || rowObj["Incident Type"] || "";
            const type = normalizeType(rowObj.Type || rowObj["Nature"]);
            const reporter = rowObj.Reporter || rowObj["Submitted By"] || "Anonymous";
            const anonymous = (rowObj.Anonymous || "").toString().toLowerCase() === "true" || reporter.toLowerCase() === "anonymous";
            const date = parseDate(rowObj.Timestamp || rowObj.Date);
            const slaHours = severity === "Critical" ? 24 : severity === "High" ? 72 : 168;
            const dueDate = new Date(new Date(date).getTime() + slaHours * 3600000).toISOString();
            const id = `RPT-${uuidv4().slice(0, 8).toUpperCase()}`;
            const status = normalizeStatus(rowObj.Status || rowObj["Report Status"] || rowObj["Current Status"] || rowObj["Ticket Status"] || "Open");
            const photoUrl = (rowObj.Photo || rowObj["Photo URL"] || rowObj.Image || rowObj["Image URL"] || "").toString().trim() || getPlaceholderImageUrl(id.slice(-3), 80);
            db.prepare(`INSERT OR REPLACE INTO reports (id, date, location, reporter, description, severity, status, category, type, slaHours, dueAt, isNearMiss, anonymous, department, shift, complianceRequired, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run([id, date, location, anonymous ? "Anonymous" : reporter, description, severity, status, category, type, slaHours, dueDate, 0, anonymous ? 1 : 0, "Production", "Day", severity === "Critical" || severity === "High" ? 1 : 0, photoUrl]);
        }
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
    const total = allRows(db, "SELECT COUNT(*) as count FROM reports")[0]?.count || 0;
    res.json({ totalReports: total, configured: hasCreds, formId, hasCredentials: hasCreds });
});
router.post("/fetch", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req, res) => {
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
        for (const row of dataRows) {
            const rowObj = headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] }), {});
            const location = rowObj["1. Location"] ||
                rowObj["Location "] ||
                rowObj.Location ||
                row[1] ||
                defaults.locations[0];
            const reporter = rowObj["Enter your name here. First name and Last name"] ||
                rowObj["Kindly Provide Your Name (First name and Last name)"] ||
                rowObj.Reporter ||
                row[2] ||
                "Anonymous";
            const categoryRaw = rowObj["1. Category?"] ||
                rowObj.Category ||
                rowObj["4. Incident Category"] ||
                row[4] ||
                defaults.categories[0];
            const typeRaw = rowObj.Type ||
                rowObj["Do you want to Report an Incident or an Unsafe Act/ Condition?"] ||
                row[4] ||
                "Unsafe Condition";
            const type = typeRaw.toLowerCase().includes("condition") ? "Unsafe Condition" : "Unsafe Act";
            const severity = normalizeSeverity(rowObj["2. Risk Level"] ||
                rowObj.Severity ||
                rowObj["Risk Level"] ||
                row[7] ||
                "Medium");
            const description = rowObj["3. Describe/ list (Briefly) details of the hazard"] ||
                rowObj["5. Give a brief a description of the incident"] ||
                rowObj.Description ||
                rowObj["Incident"] ||
                row[8] ||
                "";
            const dateRaw = rowObj.Timestamp || rowObj.Date || row[0];
            const date = parseDate(dateRaw);
            const anonymous = reporter.toLowerCase() === "anonymous";
            const slaHours = severity === "Critical" ? 24 : severity === "High" ? 72 : 168;
            const dueDate = new Date(new Date(date).getTime() + slaHours * 3600000).toISOString();
            // Use a deterministic id per Google row so repeated syncs don't create duplicates.
            // Stable deterministic id so repeated syncs don't create duplicates.
            // Avoid JSON.stringify(rowObj) because header whitespace/extra columns can change between exports.
            // Use a normalized signature from the actual business fields.
            const normalize = (v) => (v ?? "").toString().trim().replace(/\s+/g, " ");
            const rowKey = [
                normalize(dateRaw),
                normalize(location),
                normalize(reporter),
                normalize(description),
                normalize(categoryRaw),
                normalize(typeRaw),
                normalize(severity),
            ].join("::");
            // Simple deterministic hash (no extra dependencies): FNV-1a 32-bit
            let hash = 0x811c9dc5;
            for (let i = 0; i < rowKey.length; i++) {
                hash ^= rowKey.charCodeAt(i);
                hash = Math.imul(hash, 0x01000193);
            }
            const stableIdHash = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
            const id = `RPT-${stableIdHash}`;
            const category = categoryRaw || defaults.categories[0];
            const department = defaults.departments[0];
            const shift = "Day";
            const status = normalizeStatus(rowObj.Status || rowObj["Report Status"] || rowObj["Current Status"] || rowObj["Ticket Status"] || "Open");
            const photoUrl = (rowObj.Photo || rowObj["Photo URL"] || rowObj.Image || rowObj["Image URL"] || "").toString().trim() || getPlaceholderImageUrl(id.slice(-3), 80);
            if (isFirebaseAvailable()) {
                const db = getFirebase();
                const newReport = {
                    id, date, location, reporter: anonymous ? "Anonymous" : reporter,
                    description, severity, status, category, type, slaHours, dueAt: dueDate,
                    isNearMiss: false, anonymous: anonymous ? 1 : 0, department, shift,
                    complianceRequired: severity === "Critical" || severity === "High" ? 1 : 0,
                    photoUrl, comments: [],
                };
                await db.collection("reports").doc(id).set(newReport);
                broadcastReport(newReport);
            }
            else {
                const db = await getDb();
                db.prepare(`INSERT OR REPLACE INTO reports (id, date, location, reporter, description, severity, status, category, type, slaHours, dueAt, isNearMiss, anonymous, department, shift, complianceRequired, photoUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run([id, date, location, anonymous ? "Anonymous" : reporter, description, severity, status, category, type, slaHours, dueDate, 0, anonymous ? 1 : 0, department, shift, severity === "Critical" || severity === "High" ? 1 : 0, photoUrl]);
                await saveDb(db);
                broadcastReport({
                    id, date, location, reporter: anonymous ? "Anonymous" : reporter,
                    description, severity, status, category, type, slaHours, dueAt: dueDate,
                    isNearMiss: false, anonymous, comments: [], department, shift,
                    complianceRequired: severity === "Critical" || severity === "High",
                    photoUrl,
                });
            }
            importedCount++;
        }
        // Update sync timestamp
        const maxTimestamp = dataRows.reduce((max, row) => {
            const ts = row[0] || ""; // Column A = Timestamp
            return ts && (!max || ts > max) ? ts : max;
        }, "");
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            await db.collection("syncMeta").doc("googleForms").set({ lastTimestamp: maxTimestamp, lastSync: new Date().toISOString() });
        }
        else if (maxTimestamp) {
            const db = await getDb();
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('google_forms_sync', ?)").run([JSON.stringify({ lastTimestamp: maxTimestamp, lastSync: new Date().toISOString() })]);
            await saveDb(db);
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
        console.error("Google Forms fetch error:", classified);
        res.status(classified.statusCode).json({
            error: classified.message,
            details: classified.details,
            hint: classified.hint,
        });
    }
});
export default router;
