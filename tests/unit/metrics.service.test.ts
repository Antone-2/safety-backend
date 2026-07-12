import { describe, expect, it } from "vitest";
import { MetricsService } from "../../src/shared/metrics/metrics.service.js";

describe("MetricsService", () => {
  it("records and summarizes request metrics", () => {
    const service = new MetricsService();
    service.recordRequest("GET", "/health", 200, 12);
    service.recordRequest("GET", "/health", 500, 45);

    const snapshot = service.getSnapshot();

    expect(snapshot.requestsTotal).toBe(2);
    expect(snapshot.errorsTotal).toBe(1);
    expect(snapshot.requestsByMethod.GET).toBe(2);
    expect(snapshot.requestsByStatus["500"]).toBe(1);
    expect(snapshot.requestsByPath["/health"]).toBe(2);
  });
});
