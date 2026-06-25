import test from "node:test";
import assert from "node:assert/strict";
import { classifyGoogleFormsError } from "./google-forms.js";
test("classifies DNS lookup failures as connectivity issues", () => {
    const error = new TypeError("fetch failed");
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
        hint: "Check the spreadsheet ID, API key, and network connectivity.",
    });
});
