import test from "node:test";
import assert from "node:assert/strict";
import { buildDriveFetchCandidates, buildReportPhotoStorageKey, storeReportPhotoFromDrive } from "./report-photo.service.js";

test("buildDriveFetchCandidates includes direct download and view URLs", () => {
  const candidates = buildDriveFetchCandidates("abc123");

  assert.ok(candidates.includes("https://drive.google.com/uc?export=download&id=abc123"));
  assert.ok(candidates.includes("https://drive.google.com/uc?export=view&id=abc123"));
});

test("buildReportPhotoStorageKey uses the report id and an image extension", () => {
  const key = buildReportPhotoStorageKey("RPT-123", "image/png", "photo.png");

  assert.match(key, /^reports\/photos\/RPT-123\/.+\.png$/);
});

test("storeReportPhotoFromDrive strips junk appended to a Drive id", async () => {
  const originalFetch = global.fetch;
  const fetchUrls: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchUrls.push(requestUrl);
    return new Response("", { status: 404 });
  }) as typeof fetch;

  try {
    const stored = await storeReportPhotoFromDrive(
      "RPT-123",
      "https://drive.google.com/uc?export=view&id=1RLPMP3JMVyMsZVgELj5hZulwhFqawRU5%2C%20https%3A",
    );

    assert.equal(stored, false);
    assert.ok(fetchUrls.every((url) => !url.includes("%2C%20https%3A")));
    assert.ok(fetchUrls.some((url) => url.includes("id=1RLPMP3JMVyMsZVgELj5hZulwhFqawRU5")));
  } finally {
    global.fetch = originalFetch;
  }
});
