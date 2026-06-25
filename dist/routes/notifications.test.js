import test from "node:test";
import assert from "node:assert/strict";
import { getDb, saveDb } from "../lib/database.js";
import { listNotifications, markNotificationsRead } from "./notifications.js";
test("listNotifications returns persisted notifications and marks them read", async () => {
    const db = await getDb();
    const id = `notif-test-${Date.now()}`;
    db.prepare("INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run([id, "RPT-1001", "email", "ops@example.com", "Incident alert", "A new incident was logged", 1, new Date().toISOString(), 0]);
    await saveDb(db);
    const notifications = await listNotifications();
    const created = notifications.find((item) => item.id === id);
    assert.ok(created, "expected notification to be present");
    assert.equal(created?.read, false);
    await markNotificationsRead([id]);
    const updatedNotifications = await listNotifications();
    const updated = updatedNotifications.find((item) => item.id === id);
    assert.ok(updated, "expected notification to remain present after updating");
    assert.equal(updated?.read, true);
});
