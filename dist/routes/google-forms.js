import fs from "fs";
import { Router } from "express";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore } from "../lib/firebase.js";
import { getDb, saveDb } from "../lib/database.js";
import { REPORT_SOURCE_GOOGLE_SHEETS } from "../lib/types.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { broadcastReport } from "../modules/reports/reports.module.js";
import { getGoogleDocsBaseUrl, getGoogleSheetsBaseUrl, getPlaceholderImageUrl } from "../lib/config.js";
import { logger } from "../shared/utils/logger.js";
const router = Router();
const SYNC_STATE_ID = "google_forms";
const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let syncInFlight = null;
let syncSchedulerStarted = false;
let postgresAvailableForGoogleSheets = true;
const googleSheetsQuotaCooldownUntil = { timestamp: 0 };
export function setGoogleSheetsPostgresAvailability(available) {
    postgresAvailableForGoogleSheets = available;
}
function assertGoogleSheetsPostgresAvailable() {
    if (!postgresAvailableForGoogleSheets) {
        throw new Error("PostgreSQL is unavailable; Google Sheets sync requires the local database.");
    }
}
function isGoogleSheetsQuotaCooldownActive() {
    return Date.now() < googleSheetsQuotaCooldownUntil.timestamp;
}
function setGoogleSheetsQuotaCooldown(seconds) {
    googleSheetsQuotaCooldownUntil.timestamp = Date.now() + seconds * 1000;
}
function sanitizeSqliteBindValue(value, fallback = "") {
    // sqlite drivers like better-sqlite3/bindings can throw if you pass `undefined`.
    if (value === undefined)
        return fallback;
    if (value === null)
        return fallback;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : fallback;
    if (typeof value === "boolean")
        return value ? 1 : 0;
    // For Date objects or other primitives, String() is safe.
    return String(value);
}
function isPermissionBlockedGoogleSheetsError(message) {
    // Your logs show: API_KEY_SERVICE_BLOCKED
    return /API_KEY_SERVICE_BLOCKED|403 Forbidden|permission denied|access denied/i.test(message);
}
function isQuotaExhaustedError(error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /RESOURCE_EXHAUSTED|quota exceeded/i.test(message);
}
async function fetchWithTimeout(url, init, ms = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
// Falls back to a service-account bearer token when the API key is blocked.
// Requires the spreadsheet to be shared with the service-account email and
// the Sheets API enabled in the service account's project.
let lastServiceAccountError = null;
async function getServiceAccountAccessToken() {
    try {
        const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!saPath)
            return null;
        if (!fs.existsSync(saPath))
            return null;
        const creds = JSON.parse(await fs.promises.readFile(saPath, "utf8"));
        if (!creds.client_email || !creds.private_key)
            return null;
        const { JWT } = await import("google-auth-library");
        const client = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const token = await client.getAccessToken();
        return token.token || null;
    }
    catch {
        return null;
    }
}
async function tryServiceAccountSheet(formId, sheetName) {
    try {
        const token = await getServiceAccountAccessToken();
        if (!token)
            return null;
        const apiBaseUrl = getGoogleSheetsBaseUrl().replace(/\/$/, "");
        const rangePath = `${encodeURIComponent(`'${sheetName}'`)}!A:ZZ`;
        const apiUrl = `${apiBaseUrl}/spreadsheets/${formId}/values/${rangePath}`;
        const res = await fetchWithTimeout(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            lastServiceAccountError = new Error(`Google Sheets service-account error: ${res.status} ${res.statusText} (body: ${body.slice(0, 500)})`);
            return null;
        }
        const data = (await res.json());
        return { rows: data.values || [], sheetName };
    }
    catch (error) {
        lastServiceAccountError = error;
        return null;
    }
}
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
    if (isGoogleSheetsQuotaCooldownActive()) {
        throw new Error("Google API quota exceeded. Please wait before retrying.");
    }
    lastServiceAccountError = null;
    const candidates = getSheetCandidates(requestedSheetName);
    let lastError;
    for (const sheetName of candidates) {
        const apiBaseUrl = getGoogleSheetsBaseUrl().replace(/\/$/, "");
        const rangePath = `${encodeURIComponent(`'${sheetName}'`)}!A:ZZ`;
        const apiUrl = `${apiBaseUrl}/spreadsheets/${formId}/values/${rangePath}?key=${apiKey}`;
        try {
            const apiResponse = await fetchWithTimeout(apiUrl);
            if (apiResponse.ok) {
                const data = (await apiResponse.json());
                return { rows: data.values || [], sheetName };
            }
            const body = await apiResponse.text();
            lastError = new Error(`Google Sheets API error: ${apiResponse.status} ${apiResponse.statusText} (body: ${body.slice(0, 500)})`);
            // API key blocked/forbidden -> attempt service-account bearer token.
            if (apiResponse.status === 403 && isPermissionBlockedGoogleSheetsError(body)) {
                const saResult = await tryServiceAccountSheet(formId, sheetName);
                if (saResult)
                    return saResult;
            }
        }
        catch (error) {
            lastError = error;
            if (isQuotaExhaustedError(error)) {
                setGoogleSheetsQuotaCooldown(300);
                break;
            }
        }
    }
    try {
        const docsBaseUrlRaw = getGoogleDocsBaseUrl();
        const docsBaseUrl = docsBaseUrlRaw.trim().replace(/\/$/, "");
        // If export base URL isn't configured, the CSV fallback would become a relative URL
        // like `/.../export?format=csv` which fails URL parsing.
        if (docsBaseUrl) {
            const csvUrl = `${docsBaseUrl}/${formId}/export?format=csv`;
            const csvResponse = await fetchWithTimeout(csvUrl);
            if (csvResponse.ok) {
                const csvText = await csvResponse.text();
                return { rows: parseCsvText(csvText), sheetName: candidates[0] || "Sheet1" };
            }
            const body = await csvResponse.text().catch(() => "");
            lastError = new Error(`Google CSV export error: ${csvResponse.status} ${csvResponse.statusText} (body: ${body.slice(0, 500)})`);
        }
        else {
            // Keep lastError from the Sheets API attempt; CSV fallback is impossible.
            if (!lastError) {
                lastError = new Error("Google docs export base URL is not configured (GOOGLE_DOCS_EXPORT_BASE_URL / GOOGLE_DOCS_BASE_URL)");
            }
        }
    }
    catch (error) {
        lastError = error;
        if (isQuotaExhaustedError(error)) {
            setGoogleSheetsQuotaCooldown(300);
        }
    }
    if (!lastError && lastServiceAccountError)
        lastError = lastServiceAccountError;
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
export function parseDate(dateStr) {
    if (!dateStr)
        return new Date().toISOString();
    const value = dateStr.trim();
    if (!value)
        return new Date().toISOString();
    const spreadsheetSerial = Number(value);
    if (Number.isFinite(spreadsheetSerial) && spreadsheetSerial > 0) {
        const excelEpochOffset = 25569;
        const millisecondsPerDay = 86400000;
        return new Date((spreadsheetSerial - excelEpochOffset) * millisecondsPerDay).toISOString();
    }
    const dayFirstMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (dayFirstMatch) {
        const [, firstRaw, secondRaw, yearRaw, hourRaw, minuteRaw, secondPartRaw, meridiemRaw] = dayFirstMatch;
        const first = Number(firstRaw);
        const second = Number(secondRaw);
        const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
        const isDayFirst = process.env.GOOGLE_SHEETS_DATE_ORDER?.toLowerCase() === "mdy" ? false : first > 12 || process.env.GOOGLE_SHEETS_DATE_ORDER?.toLowerCase() === "dmy" || second <= 12;
        const day = isDayFirst ? first : second;
        const month = isDayFirst ? second : first;
        let hour = hourRaw ? Number(hourRaw) : 0;
        const minute = minuteRaw ? Number(minuteRaw) : 0;
        const secondPart = secondPartRaw ? Number(secondPartRaw) : 0;
        const meridiem = meridiemRaw?.toUpperCase();
        if (meridiem === "PM" && hour < 12)
            hour += 12;
        if (meridiem === "AM" && hour === 12)
            hour = 0;
        const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, secondPart));
        if (parsed.getUTCFullYear() === year &&
            parsed.getUTCMonth() === month - 1 &&
            parsed.getUTCDate() === day) {
            return parsed.toISOString();
        }
    }
    const d = new Date(value);
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
        // sqlite/better-sqlite3 (or similar) will throw if any bound value is `undefined`.
        // Ensure every column value is always a concrete primitive.
        const sanitized = {
            id: String(report.id ?? ""),
            date: String(report.date ?? ""),
            location: String(report.location ?? ""),
            reporter: String(report.reporter ?? ""),
            description: String(report.description ?? ""),
            severity: String(report.severity ?? ""),
            status: String(report.status ?? ""),
            category: String(report.category ?? ""),
            type: String(report.type ?? ""),
            slaHours: Number.isFinite(report.slaHours) ? report.slaHours : 168,
            dueAt: String(report.dueAt ?? ""),
            anonymous: Boolean(report.anonymous),
            department: String(report.department ?? ""),
            shift: String(report.shift ?? ""),
            complianceRequired: Boolean(report.complianceRequired),
            photoUrl: String(report.photoUrl ?? ""),
        };
        db.prepare(`INSERT INTO reports (id, date, location, reporter, description, severity, status, category, type, slaHours, dueAt, isNearMiss, anonymous, department, shift, complianceRequired, photoUrl, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
            sanitized.id,
            sanitized.date,
            sanitized.location,
            sanitized.reporter,
            sanitized.description,
            sanitized.severity,
            sanitized.status,
            sanitized.category,
            sanitized.type,
            sanitized.slaHours,
            sanitized.dueAt,
            0,
            sanitized.anonymous ? 1 : 0,
            sanitized.department,
            sanitized.shift,
            sanitized.complianceRequired ? 1 : 0,
            sanitized.photoUrl,
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
function extractPhotoUrl(headers, row) {
    const matched = getMatchingCell(headers, row, [
        "photo",
        "photo url",
        "image",
        "image url",
        "photo link",
        "image link",
        "attachment",
        "attachments",
        "upload photo",
        "upload image",
        "hazard photo",
        "incident photo",
    ]);
    if (matched && matched.trim())
        return matched.trim();
    const urlRegex = /https?:\/\/[^\s,]+/g;
    const candidates = [];
    for (const cell of row) {
        const matches = cell.match(urlRegex);
        if (matches)
            candidates.push(...matches);
    }
    return candidates.join(", ");
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
    const reporter = getMatchingCell(headers, row, ["reporter", "reporter name", "submitted by", "submitted by name", "name", "your name", "full name", "person reporting", "employee", "employee name", "staff", "staff name"], 2) || "Anonymous";
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
    const photoUrl = extractPhotoUrl(headers, row);
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
async function updateSyncState(update) {
    // Build the statement dynamically so we only touch the columns that were
    // actually provided. Columns left out of the INSERT use their table DEFAULT
    // (which satisfies the NOT NULL constraints on first insert), and on conflict
    // they are preserved by referencing the existing row instead of EXCLUDED.
    const columns = ["id", "status", "last_error"];
    const values = [SYNC_STATE_ID, update.status, update.error ?? null];
    const sets = [
        "status = EXCLUDED.status",
        "last_error = EXCLUDED.last_error",
        "updated_at = NOW()",
    ];
    const optionalFields = [
        { col: "last_started_at", value: update.startedAt },
        { col: "last_finished_at", value: update.finishedAt },
        { col: "last_success_at", value: update.successAt },
        { col: "last_sheet_name", value: update.sheetName },
        { col: "last_row_count", value: update.rowCount },
        { col: "last_imported_count", value: update.importedCount },
    ];
    for (const field of optionalFields) {
        if (field.value !== undefined) {
            values.push(field.value);
            columns.push(field.col);
            sets.push(`${field.col} = EXCLUDED.${field.col}`);
        }
        else {
            sets.push(`${field.col} = google_sheets_sync_state.${field.col}`);
        }
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await pgPool.query(`INSERT INTO google_sheets_sync_state (${columns.join(", ")}, updated_at)
     VALUES (${placeholders}, NOW())
     ON CONFLICT (id) DO UPDATE SET
       ${sets.join(", ")}`, values);
}
async function replaceGoogleSheetReportsInPostgres(reports) {
    const client = await pgPool.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM reports WHERE source = $1", [REPORT_SOURCE_GOOGLE_SHEETS]);
        for (const report of reports) {
            await client.query(`INSERT INTO reports (
          id,
          date,
          location,
          reporter,
          description,
          severity,
          status,
          category,
          type,
          sla_hours,
          due_at,
          is_near_miss,
          anonymous,
          department,
          shift,
          compliance_required,
          photo_url,
          source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, FALSE, $12, $13, $14, $15, $16, $17
        )`, [
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
                report.anonymous,
                report.department,
                report.shift,
                report.complianceRequired,
                report.photoUrl,
                REPORT_SOURCE_GOOGLE_SHEETS,
            ]);
        }
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function runGoogleSheetsSync(options) {
    assertGoogleSheetsPostgresAvailable();
    if (syncInFlight)
        return syncInFlight;
    syncInFlight = (async () => {
        const startedAt = new Date().toISOString();
        const formId = options?.spreadsheetId || process.env.GOOGLE_FORM_ID;
        const apiKey = options?.apiKey || process.env.GOOGLE_API_KEY;
        const sheetName = options?.sheetName || process.env.GOOGLE_SHEET_NAME || "Unsafe Acts/ Conditions (Responses)";
        if (!formId)
            throw new Error("Google Form ID not configured");
        if (!apiKey)
            throw new Error("Google API key required");
        await updateSyncState({ status: "running", startedAt, error: null });
        try {
            const fetched = await fetchGoogleSheetRows(formId, apiKey, sheetName);
            const rows = fetched.rows;
            if (rows.length < 2) {
                const finishedAt = new Date().toISOString();
                await replaceGoogleSheetReportsInPostgres([]);
                await updateSyncState({
                    status: "idle",
                    finishedAt,
                    successAt: finishedAt,
                    sheetName: fetched.sheetName,
                    rowCount: rows.length,
                    importedCount: 0,
                    error: null,
                });
                return { imported: 0, rows: rows.length, sheetName: fetched.sheetName, startedAt, finishedAt };
            }
            const headers = rows[0];
            const dataRows = rows.slice(1);
            const defaults = getDefaults();
            const reports = dataRows.map((row) => {
                const imported = buildReportRecordFromRow(headers, row, defaults);
                const id = buildReportIdForImportedRecord(imported);
                return {
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
                    photoUrl: imported.photoUrl.trim() || getPlaceholderImageUrl(id.slice(-3), 80),
                };
            });
            await replaceGoogleSheetReportsInPostgres(reports);
            if (options?.broadcast !== false) {
                for (const report of reports.slice(0, 50)) {
                    broadcastReport({
                        ...report,
                        source: REPORT_SOURCE_GOOGLE_SHEETS,
                        isNearMiss: false,
                        comments: [],
                    });
                }
            }
            const finishedAt = new Date().toISOString();
            await updateSyncState({
                status: "idle",
                finishedAt,
                successAt: finishedAt,
                sheetName: fetched.sheetName,
                rowCount: rows.length,
                importedCount: reports.length,
                error: null,
            });
            return { imported: reports.length, rows: rows.length, sheetName: fetched.sheetName, startedAt, finishedAt };
        }
        catch (error) {
            const finishedAt = new Date().toISOString();
            const classified = classifyGoogleFormsError(error);
            await updateSyncState({
                status: "failed",
                finishedAt,
                error: `${classified.message} ${classified.details}`.slice(0, 2000),
            });
            throw error;
        }
    })();
    try {
        return await syncInFlight;
    }
    finally {
        syncInFlight = null;
    }
}
async function runGoogleSheetsSyncToSqlite(options) {
    const startedAt = new Date().toISOString();
    const fetched = await fetchGoogleSheetRows(options.spreadsheetId, options.apiKey, options.sheetName || process.env.GOOGLE_SHEET_NAME || "Unsafe Acts/ Conditions (Responses)");
    const rows = fetched.rows;
    const finishedAt = new Date().toISOString();
    if (rows.length < 2) {
        const db = await getDb();
        replaceGoogleSheetReportsInSqlite(db, []);
        await saveDb(db);
        return { imported: 0, rows: rows.length, sheetName: fetched.sheetName, startedAt, finishedAt };
    }
    const headers = rows[0];
    const defaults = getDefaults();
    const reports = rows.slice(1).map((row) => {
        const imported = buildReportRecordFromRow(headers, row, defaults);
        const id = buildReportIdForImportedRecord(imported);
        return {
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
            photoUrl: imported.photoUrl.trim() || getPlaceholderImageUrl(id.slice(-3), 80),
        };
    });
    const db = await getDb();
    replaceGoogleSheetReportsInSqlite(db, reports);
    await saveDb(db);
    return { imported: reports.length, rows: rows.length, sheetName: fetched.sheetName, startedAt, finishedAt };
}
export function queueGoogleSheetsSync(options) {
    if (syncInFlight)
        return syncInFlight;
    const task = runGoogleSheetsSync(options).catch((error) => {
        logger.warn({ err: error }, "Google Sheets background sync failed.");
        throw error;
    });
    task.catch(() => undefined);
    return task;
}
export function startGoogleSheetsScheduler(intervalMs = Number(process.env.GOOGLE_SHEETS_SYNC_INTERVAL_MS || DEFAULT_SYNC_INTERVAL_MS)) {
    if (syncSchedulerStarted)
        return;
    syncSchedulerStarted = true;
    if (!postgresAvailableForGoogleSheets) {
        logger.warn("Google Sheets scheduler not started; PostgreSQL is unavailable.");
        return;
    }
    if (!process.env.GOOGLE_FORM_ID || !process.env.GOOGLE_API_KEY) {
        logger.warn("Google Sheets scheduler not started; GOOGLE_FORM_ID or GOOGLE_API_KEY is missing.");
        return;
    }
    setTimeout(() => queueGoogleSheetsSync({ broadcast: false }), 5000);
    setInterval(() => queueGoogleSheetsSync({ broadcast: false }), Math.max(intervalMs, 60000));
    logger.info({ intervalMs }, "Google Sheets scheduler started.");
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
    // API key service blocked (Google Sheets API not enabled for the project/key)
    if (/API_KEY_SERVICE_BLOCKED/i.test(message)) {
        return {
            statusCode: 403,
            message: "Google Sheets API is blocked for this API key.",
            details: stack ? `${message} (stack: ${stack.slice(0, 600)})` : message,
            hint: "Go to Google Cloud Console, select project 271404086632, enable the Google Sheets API, and ensure your API key is allowed to access it.",
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
    // Quota exceeded / rate limit
    if (/RESOURCE_EXHAUSTED|quota exceeded|rate limit|too many requests/i.test(message)) {
        return {
            statusCode: 429,
            message: "Google API quota exceeded.",
            details: stack ? `Quota limit reached: ${message.slice(0, 300)} (stack: ${stack.slice(0, 600)})` : `Quota limit reached: ${message.slice(0, 300)}`,
            hint: "Wait a few minutes and retry, or increase your Google API quota in the Google Cloud Console.",
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
                await db.collection("reports").doc(id).set(sanitizeForFirestore({
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
                }));
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
    if (!postgresAvailableForGoogleSheets) {
        return res.status(503).json({
            configured: Boolean(process.env.GOOGLE_FORM_ID && process.env.GOOGLE_API_KEY),
            status: "degraded",
            error: "PostgreSQL is unavailable; Google Sheets sync status requires the local database.",
        });
    }
    const formId = process.env.GOOGLE_FORM_ID;
    const hasCredentials = Boolean(process.env.GOOGLE_API_KEY);
    const [countResult, stateResult] = await Promise.all([
        pgPool.query("SELECT COUNT(*)::int AS count FROM reports WHERE source = $1", [REPORT_SOURCE_GOOGLE_SHEETS]),
        pgPool.query("SELECT * FROM google_sheets_sync_state WHERE id = $1", [SYNC_STATE_ID]),
    ]);
    const state = stateResult.rows[0] ?? {};
    res.json({
        totalReports: countResult.rows[0]?.count ?? 0,
        configured: Boolean(formId && hasCredentials),
        formId,
        hasCredentials,
        status: state.status ?? "idle",
        lastStartedAt: state.last_started_at ?? null,
        lastFinishedAt: state.last_finished_at ?? null,
        lastSuccessAt: state.last_success_at ?? null,
        lastError: state.last_error ?? null,
        lastSheetName: state.last_sheet_name ?? null,
        lastRowCount: state.last_row_count ?? 0,
        lastImportedCount: state.last_imported_count ?? 0,
    });
});
router.post("/fetch", async (req, res) => {
    const body = req.body ?? {};
    const wait = Boolean(body.wait);
    if (!postgresAvailableForGoogleSheets) {
        if (wait) {
            const formId = body.spreadsheetId || process.env.GOOGLE_FORM_ID;
            const apiKey = body.apiKey || process.env.GOOGLE_API_KEY;
            const sheetName = body.sheetName || "Unsafe Acts/ Conditions (Responses)";
            if (!formId)
                return res.status(400).json({ error: "Google Form ID not configured" });
            if (!apiKey)
                return res.status(400).json({ error: "Google API key required" });
            try {
                const result = await runGoogleSheetsSyncToSqlite({ spreadsheetId: formId, apiKey, sheetName });
                return res.json({
                    queued: false,
                    imported: result.imported,
                    rows: result.rows,
                    sheetName: result.sheetName,
                    storage: "sqlite",
                    message: `Google Sheets full sync complete. Imported ${result.imported} reports from ${result.rows} sheet rows.`,
                });
            }
            catch (error) {
                const classified = classifyGoogleFormsError(error);
                return res.status(classified.statusCode).json({
                    error: classified.message,
                    details: classified.details,
                });
            }
        }
        return res.status(503).json({
            queued: false,
            error: "PostgreSQL is unavailable; Google Sheets sync requires the local database.",
        });
    }
    const formId = body.spreadsheetId || process.env.GOOGLE_FORM_ID;
    const apiKey = body.apiKey || process.env.GOOGLE_API_KEY;
    const sheetName = body.sheetName || "Unsafe Acts/ Conditions (Responses)";
    if (!formId)
        return res.status(400).json({ error: "Google Form ID not configured" });
    if (!apiKey)
        return res.status(400).json({ error: "Google API key required" });
    if (wait) {
        try {
            const result = await runGoogleSheetsSync({ spreadsheetId: formId, apiKey, sheetName });
            return res.json({
                queued: false,
                imported: result.imported,
                rows: result.rows,
                sheetName: result.sheetName,
                message: `Google Sheets full sync complete. Imported ${result.imported} reports from ${result.rows} sheet rows.`,
            });
        }
        catch (error) {
            const classified = classifyGoogleFormsError(error);
            return res.status(classified.statusCode).json({
                error: classified.message,
                details: classified.details,
            });
        }
    }
    queueGoogleSheetsSync({ spreadsheetId: formId, apiKey, sheetName });
    res.status(202).json({
        queued: true,
        message: "Google Sheets sync queued. Dashboard will continue using local database data.",
    });
});
export default router;
