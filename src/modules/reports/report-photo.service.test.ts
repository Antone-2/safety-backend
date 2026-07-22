import test from "node:test";
import assert from "node:assert/strict";
import { buildDriveFetchCandidates, buildReportPhotoStorageKey } from "./report-photo.service.js";

test("buildDriveFetchCandidates includes direct download and view URLs", () => {
  const candidates = buildDriveFetchCandidates("abc123");

  assert.ok(candidates.includes("https://drive.google.com/uc?export=download&id=abc123"));
  assert.ok(candidates.includes("https://drive.google.com/uc?export=view&id=abc123"));
});

test("buildReportPhotoStorageKey uses the report id and an image extension", () => {
  const key = buildReportPhotoStorageKey("RPT-123", "image/png", "photo.png");

  assert.match(key, /^reports\/photos\/RPT-123\/.+\.png$/);
});
