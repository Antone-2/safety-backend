import test from "node:test";
import assert from "node:assert/strict";
import { classifyGoogleFormsError, dedupeGoogleSheetReportsById, fetchGoogleSheetRows, getGoogleSheetReportIdsToDelete, parseDate } from "./google-forms.js";

test("classifies DNS lookup failures as connectivity issues", () => {
  const error = new TypeError("fetch failed") as TypeError & { cause?: { code?: string; hostname?: string } };
  error.cause = { code: "ENOTFOUND", hostname: "sheets.googleapis.com" };

  assert.deepEqual(classifyGoogleFormsError(error), {
    statusCode: 502,
    message: "Unable to reach Google Sheets from the server right now.",
    details: "DNS lookup failed for sheets.googleapis.com",
    hint: "Check network connectivity or Google Sheets access settings.",
  });
});

test("falls back to a generic message for unknown errors", () => {
  const error = new Error("boom");

  assert.deepEqual(classifyGoogleFormsError(error), {
    statusCode: 500,
    message: "Google Sheets request failed.",
    details: "boom",
    hint: "Check the spreadsheet ID, API key, and which Sheets/CSV base URLs are configured.",
  });
});

test("dedupes imported Google Sheets reports by stable report id", () => {
  const reports = [
    { id: "RPT-1", date: "2026-01-01T00:00:00.000Z", location: "A", reporter: "Alice", description: "First", severity: "High", status: "Open", category: "Unsafe Act", type: "Unsafe Act", slaHours: 24, dueAt: "2026-01-02T00:00:00.000Z", anonymous: false, department: "Ops", shift: "Day", complianceRequired: true, photoUrl: "" },
    { id: "RPT-1", date: "2026-01-02T00:00:00.000Z", location: "A", reporter: "Alice", description: "Updated", severity: "High", status: "Open", category: "Unsafe Act", type: "Unsafe Act", slaHours: 24, dueAt: "2026-01-03T00:00:00.000Z", anonymous: false, department: "Ops", shift: "Day", complianceRequired: true, photoUrl: "" },
    { id: "RPT-2", date: "2026-01-03T00:00:00.000Z", location: "B", reporter: "Bob", description: "Second", severity: "Medium", status: "Closed", category: "Unsafe Condition", type: "Unsafe Condition", slaHours: 72, dueAt: "2026-01-06T00:00:00.000Z", anonymous: true, department: "Maintenance", shift: "Night", complianceRequired: false, photoUrl: "" },
  ];

  const deduped = dedupeGoogleSheetReportsById(reports);

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, "RPT-1");
  assert.equal(deduped[0].description, "Updated");
  assert.equal(deduped[1].id, "RPT-2");
});

test("does not delete existing Google Sheets reports when the latest sync imports no rows", () => {
  const existingIds = ["RPT-1", "RPT-2"];
  const incomingIds: string[] = [];

  assert.deepEqual(getGoogleSheetReportIdsToDelete(existingIds, incomingIds), []);
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

test("parses month-first Google Sheets timestamps with default mdy order", () => {
  assert.equal(parseDate("3/25/2026 9:52:49"), "2026-03-25T06:52:49.000Z");
  assert.equal(parseDate("4/10/2026 13:44:17"), "2026-04-10T10:44:17.000Z");
  assert.equal(parseDate("5/4/2026 9:26:49"), "2026-05-04T06:26:49.000Z");
});

test("falls back to day-first when the first part exceeds 12", () => {
  assert.equal(parseDate("13/07/2026 14:35:10"), "2026-07-13T11:35:10.000Z");
});

test("honors explicit dmy date order", () => {
  const previous = process.env.GOOGLE_SHEETS_DATE_ORDER;
  process.env.GOOGLE_SHEETS_DATE_ORDER = "dmy";
  try {
    assert.equal(parseDate("4/10/2026 13:44:17"), "2026-10-04T10:44:17.000Z");
  } finally {
    if (previous === undefined) {
      delete process.env.GOOGLE_SHEETS_DATE_ORDER;
    } else {
      process.env.GOOGLE_SHEETS_DATE_ORDER = previous;
    }
  }
});
