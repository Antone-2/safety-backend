import test from "node:test";
import assert from "node:assert/strict";
import { buildReportRecordFromRow, buildReportIdForImportedRecord, classifyGoogleFormsError, fetchGoogleSheetRows } from "./google-forms.js";

test("classifies DNS lookup failures as connectivity issues", () => {
  const error = new TypeError("fetch failed") as TypeError & { cause?: { code?: string; hostname?: string } };
  error.cause = { code: "ENOTFOUND", hostname: "sheets.googleapis.com" };

  assert.deepEqual(classifyGoogleFormsError(error), {
    statusCode: 502,
    message: "Unable to reach Google Sheets from the server right now.",
    details: "DNS lookup failed for sheets.googleapis.com",
    hint: "Check network connectivity, firewall, and Google Sheets access settings.",
  });
});

test("falls back to a generic message for unknown errors", () => {
  const error = new Error("boom");

  assert.match(classifyGoogleFormsError(error).details, /^boom/);
  assert.equal(classifyGoogleFormsError(error).statusCode, 500);
  assert.equal(classifyGoogleFormsError(error).message, "Google Sheets request failed.");
  assert.equal(classifyGoogleFormsError(error).hint, "Check the spreadsheet ID, API key, and which Sheets/CSV base URLs are configured.");
});

test("maps alternate Google Form headers into report fields", () => {
  const headers = ["Timestamp", "Location", "Reporter Name", "Incident Summary", "Hazard Category", "Type", "Risk Level"];
  const row = ["2024-01-01", "Factory A", "Jane Doe", "Chemical spill", "Chemical", "Unsafe Condition", "High"];

  const report = buildReportRecordFromRow(headers, row, {
    locations: ["Factory A"],
    categories: ["Chemical"],
    departments: ["Production"],
  });

  assert.equal(report.location, "Factory A");
  assert.equal(report.reporter, "Jane Doe");
  assert.equal(report.category, "Chemical");
  assert.equal(report.type, "Unsafe Condition");
  assert.equal(report.severity, "High");
  assert.equal(report.description, "Chemical spill");
});

test("maps employee name headers into reporter field", () => {
  const headers = ["Timestamp", "Location", "Employee Name", "Incident Summary", "Hazard Category", "Type", "Risk Level"];
  const row = ["2024-01-01", "Factory A", "John Smith", "Chemical spill", "Chemical", "Unsafe Condition", "High"];

  const report = buildReportRecordFromRow(headers, row, {
    locations: ["Factory A"],
    categories: ["Chemical"],
    departments: ["Production"],
  });

  assert.equal(report.reporter, "John Smith");
});

test("maps staff name headers into reporter field", () => {
  const headers = ["Timestamp", "Location", "Staff Name", "Incident Description", "Hazard Category", "Type", "Risk Level"];
  const row = ["2024-01-01", "Factory A", "Mary Johnson", "Chemical spill", "Chemical", "Unsafe Condition", "High"];

  const report = buildReportRecordFromRow(headers, row, {
    locations: ["Factory A"],
    categories: ["Chemical"],
    departments: ["Production"],
  });

  assert.equal(report.reporter, "Mary Johnson");
});

test("creates a deterministic report ID for repeated imports of the same content", () => {
  const headers = ["Timestamp", "Location", "Reporter Name", "Incident Summary", "Hazard Category", "Type", "Risk Level"];
  const row = ["2024-01-01", "Factory A", "Jane Doe", "Chemical spill", "Chemical", "Unsafe Condition", "High"];

  const firstRecord = buildReportRecordFromRow(headers, row, {
    locations: ["Factory A"],
    categories: ["Chemical"],
    departments: ["Production"],
  });

  const secondRecord = buildReportRecordFromRow(headers, row, {
    locations: ["Factory A"],
    categories: ["Chemical"],
    departments: ["Production"],
  });

  assert.equal(buildReportIdForImportedRecord(firstRecord), buildReportIdForImportedRecord(secondRecord));
  assert.match(buildReportIdForImportedRecord(firstRecord), /^RPT-[0-9A-F]{8}$/);
});

test("falls back to the published CSV endpoint when the Sheets API returns 403", async () => {
  const originalFetch = global.fetch;
  const requestUrls: string[] = [];

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requestUrls.push(requestUrl);

    if (requestUrl.includes("/values/")) {
      return new Response("", { status: 403, statusText: "Forbidden" });
    }

    return new Response("Timestamp,Location\n2024-01-01,Factory\n", {
      status: 200,
      headers: { "Content-Type": "text/csv" },
    });
  }) as typeof fetch;

  try {
    const result = await fetchGoogleSheetRows("spreadsheet-id", "api-key", "Sheet1");
    assert.deepEqual(result.rows, [["Timestamp", "Location"], ["2024-01-01", "Factory"]]);
    assert.ok(requestUrls.some((url) => url.includes("gviz/tq") || url.includes("export?format=csv")));
  } finally {
    global.fetch = originalFetch;
  }
});
