import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportIdForImportedRecord,
  classifyGoogleFormsError,
  buildReportRecordFromRow,
  dedupeGoogleSheetReportsById,
  fetchGoogleSheetRows,
  finalizeSuccessfulGoogleSheetsSync,
  getGoogleSheetReportIdsToDelete,
  parseDate,
} from "./google-forms.js";

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

test("keeps distinct Google Sheets submissions separate even when the visible report content matches", () => {
  const first = buildReportRecordFromRow(
    ["Timestamp", "Location", "Reporter", "Category", "Severity", "Description"],
    ["7/24/2026 8:33:15", "Factory", "Alice", "Slip / Trip", "High", "Wet floor near mixing line"],
    {
      locations: ["Factory"],
      categories: ["Slip / Trip"],
      departments: ["Ops"],
    },
    2,
  );
  const second = buildReportRecordFromRow(
    ["Timestamp", "Location", "Reporter", "Category", "Severity", "Description"],
    ["7/24/2026 8:34:15", "Factory", "Alice", "Slip / Trip", "High", "Wet floor near mixing line"],
    {
      locations: ["Factory"],
      categories: ["Slip / Trip"],
      departments: ["Ops"],
    },
    3,
  );

  const firstId = buildReportIdForImportedRecord(first);
  const secondId = buildReportIdForImportedRecord(second);

  assert.notEqual(firstId, secondId);
});

test("requests unformatted serial values from the Sheets API", async () => {
  const originalFetch = global.fetch;
  const requestUrls: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requestUrls.push(requestUrl);

    return new Response(JSON.stringify({ values: [["Timestamp"], [45631.52361111111]] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await fetchGoogleSheetRows("spreadsheet-id", "api-key", "Sheet1");
    assert.deepEqual(result.rows, [["Timestamp"], [45631.52361111111 as unknown as string]]);
    assert.ok(
      requestUrls.some((url) =>
        url.includes("valueRenderOption=UNFORMATTED_VALUE") &&
        url.includes("dateTimeRenderOption=SERIAL_NUMBER"),
      ),
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("finalizes sync state before starting background photo sync", async () => {
  const events: string[] = [];
  let updateFinished = false;
  const reports = [{ id: "RPT-1", photoUrl: "https://drive.google.com/uc?export=view&id=file123" }];

  const result = await finalizeSuccessfulGoogleSheetsSync({
    startedAt: "2026-07-24T08:33:15.188Z",
    sheetName: "Unsafe Acts/ Conditions (Responses)",
    rowCount: 2,
    reports,
    updateState: async () => {
      events.push("update:start");
      await Promise.resolve();
      updateFinished = true;
      events.push("update:end");
    },
    startPhotoSync: (receivedReports) => {
      events.push(`photo:${updateFinished ? "after" : "before"}`);
      assert.deepEqual(receivedReports, reports);
    },
  });

  assert.deepEqual(events, ["update:start", "update:end", "photo:after"]);
  assert.equal(result.imported, 1);
  assert.equal(result.rows, 2);
  assert.equal(result.sheetName, "Unsafe Acts/ Conditions (Responses)");
  assert.equal(result.startedAt, "2026-07-24T08:33:15.188Z");
});

test("keeps only the first valid photo URL from a multi-link Google Sheets cell", () => {
  const report = buildReportRecordFromRow(
    ["Timestamp", "Location", "Reporter", "Photo"],
    [
      "7/24/2026 8:33:15",
      "Factory",
      "Alice",
      "https://drive.google.com/open?id=1RLPMP3JMVyMsZVgELj5hZulwhFqawRU5, https://drive.google.com/open?id=1zx01OX45TjALjTxwtNYBEw291DmXWHnA",
    ],
    {
      locations: ["Factory"],
      categories: ["Unsafe Condition"],
      departments: ["Ops"],
    },
  );

  assert.equal(
    report.photoUrl,
    "https://drive.google.com/uc?export=view&id=1RLPMP3JMVyMsZVgELj5hZulwhFqawRU5",
  );
});

test("parses ambiguous Google Sheets timestamps with the default month/day/year order", () => {
  assert.equal(parseDate("3/25/2026 9:52:49"), "2026-03-25T13:52:49.000Z");
  assert.equal(parseDate("4/10/2026 13:44:17"), "2026-04-10T17:44:17.000Z");
  assert.equal(parseDate("5/4/2026 9:26:49"), "2026-05-04T13:26:49.000Z");
});

test("rejects yearless month-name timestamps that come from display formatting", () => {
  assert.throws(() => parseDate("Dec 5, 12:34"), /Invalid Google Sheets report date/);
});

test("falls back to day-first when the first part exceeds 12", () => {
  assert.equal(parseDate("13/07/2026 14:35:10"), "2026-07-13T18:35:10.000Z");
});

test("prefers the non-future interpretation for ambiguous slash dates", () => {
  assert.equal(
    parseDate("7/11/2026 13:02:41", new Date("2026-08-02T09:00:00.000Z")),
    "2026-07-11T17:02:41.000Z",
  );
});

test("honors explicit dmy date order", () => {
  const previous = process.env.GOOGLE_SHEETS_DATE_ORDER;
  process.env.GOOGLE_SHEETS_DATE_ORDER = "dmy";
  try {
    assert.equal(
      parseDate("4/10/2026 13:44:17", new Date("2026-11-01T16:00:00.000Z")),
      "2026-10-04T17:44:17.000Z",
    );
  } finally {
    if (previous === undefined) {
      delete process.env.GOOGLE_SHEETS_DATE_ORDER;
    } else {
      process.env.GOOGLE_SHEETS_DATE_ORDER = previous;
    }
  }
});

test("honors explicit mdy date order", () => {
  const previous = process.env.GOOGLE_SHEETS_DATE_ORDER;
  process.env.GOOGLE_SHEETS_DATE_ORDER = "mdy";
  try {
    assert.equal(parseDate("4/10/2026 13:44:17"), "2026-04-10T17:44:17.000Z");
  } finally {
    if (previous === undefined) {
      delete process.env.GOOGLE_SHEETS_DATE_ORDER;
    } else {
      process.env.GOOGLE_SHEETS_DATE_ORDER = previous;
    }
  }
});

test("falls back safely to dmy when the configured date order is invalid", () => {
  const previous = process.env.GOOGLE_SHEETS_DATE_ORDER;
  process.env.GOOGLE_SHEETS_DATE_ORDER = "invalid-value";
  try {
    assert.equal(parseDate("4/10/2026 13:44:17"), "2026-04-10T17:44:17.000Z");
  } finally {
    if (previous === undefined) {
      delete process.env.GOOGLE_SHEETS_DATE_ORDER;
    } else {
      process.env.GOOGLE_SHEETS_DATE_ORDER = previous;
    }
  }
});

test("accepts future Google Sheets report dates when they are valid local timestamps", () => {
  assert.equal(
    parseDate("12/31/2026 08:00:00", new Date("2026-07-28T16:00:00.000Z")),
    "2026-12-31T12:00:00.000Z",
  );
});
