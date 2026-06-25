import { Router, type Request, type Response } from "express";
import { isFirebaseAvailable, getFirebase, FieldValue } from "../lib/firebase.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { CreateCapaSchema, CapaStatusSchema } from "../lib/types.js";
import { authMiddleware, requireRole } from "./auth.js";

const router = Router();

const mapDoc = (data: any): any => ({
  id: data.id,
  incidentId: data.incidentId,
  rootCause: data.rootCause,
  action: data.action,
  owner: data.owner,
  dueDate: data.dueDate,
  status: data.status,
  priority: data.priority || "Medium",
});

const routeParam = (req: Request, name: string) => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : (value ?? "");
};

router.get("/", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (req: Request, res: Response) => {
  const incidentId = req.query.incidentId as string | undefined;
  const owner = req.query.owner as string | undefined;

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    let query: any = db.collection("capa");
    if (incidentId) query = query.where("incidentId", "==", incidentId);
    if (owner) query = query.where("owner", "==", owner);
    const snap = await query.orderBy("dueDate", "asc").get();
    return res.json(snap.docs.map((doc: any) => mapDoc(doc.data())));
  }

  const db = await getDb();
  let sql = "SELECT * FROM capa WHERE 1=1";
  const params: any[] = [];
  if (incidentId) { sql += " AND incidentId = ?"; params.push(incidentId); }
  if (owner) { sql += " AND owner = ?"; params.push(owner); }
  sql += " ORDER BY dueDate ASC";
  const rows = allRows(db, sql, params) as any[];
  res.json(rows.map(mapDoc));
});

router.post("/", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (req: Request, res: Response) => {
  const parsed = CreateCapaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const snap = await db.collection("capa").get();
    const count = snap.size;
    const id = `CAPA-${String(400 + count).padStart(3, "0")}`;
    const capa: any = {
      id,
      incidentId: parsed.data.incidentId,
      rootCause: parsed.data.rootCause,
      action: parsed.data.action,
      owner: parsed.data.owner,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
      status: "Planned",
    };
    await db.collection("capa").doc(id).set(capa);
    return res.status(201).json(mapDoc(capa));
  }

  const db = await getDb();
  const countRow = db.prepare("SELECT COUNT(*) as c FROM capa").getAsObject() as { c: number | string | null };
  const count = Number(countRow.c ?? 0);
  const id = `CAPA-${String(400 + count).padStart(3, "0")}`;
  db.prepare("INSERT INTO capa (id, incidentId, rootCause, action, owner, dueDate, priority) VALUES (?, ?, ?, ?, ?, ?, ?)").run([id, parsed.data.incidentId, parsed.data.rootCause, parsed.data.action, parsed.data.owner, parsed.data.dueDate, parsed.data.priority]);
  const row = db.prepare("SELECT * FROM capa WHERE id = ?").getAsObject([id]) as any;
  await saveDb(db);
  res.status(201).json(mapDoc(row));
});

router.patch("/:id/status", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  const parsed = CapaStatusSchema.safeParse(status);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  const id = routeParam(req, "id");

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("capa").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    const capa = doc.data() as any;
    if (parsed.data === "Verified") {
      const incident = await db.collection("reports").doc(capa.incidentId).get();
      if (incident.exists) {
        await incident.ref.update({ status: "Closed" });
      }
    }
    await doc.ref.update({ status: parsed.data });
    const updated = mapDoc((await doc.ref.get()).data());
    return res.json(updated);
  }

  const db = await getDb();
  const row = db.prepare("SELECT * FROM capa WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE capa SET status = ? WHERE id = ?").run([parsed.data, id]);
  if (parsed.data === "Verified") {
    const incident = db.prepare("SELECT id FROM reports WHERE id = ?").getAsObject([row.incidentId]) as any | undefined;
    if (incident) {
      db.prepare("UPDATE reports SET status = 'Closed' WHERE id = ?").run([incident.id]);
    }
  }
  await saveDb(db);
  res.json(mapDoc({ ...row, status: parsed.data }));
});

router.patch("/:id", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (req: Request, res: Response) => {
  const id = routeParam(req, "id");

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("capa").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    const { rootCause, action, owner, dueDate, status, priority } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (rootCause !== undefined) updates.rootCause = rootCause;
    if (action !== undefined) updates.action = action;
    if (owner !== undefined) updates.owner = owner;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    await doc.ref.update(updates);
    const updated = mapDoc((await doc.ref.get()).data());
    return res.json(updated);
  }

  const db = await getDb();
  const row = db.prepare("SELECT * FROM capa WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  const { rootCause, action, owner, dueDate, status, priority } = req.body as any;
  if (rootCause !== undefined) db.prepare("UPDATE capa SET rootCause = ? WHERE id = ?").run([rootCause, id]);
  if (action !== undefined) db.prepare("UPDATE capa SET action = ? WHERE id = ?").run([action, id]);
  if (owner !== undefined) db.prepare("UPDATE capa SET owner = ? WHERE id = ?").run([owner, id]);
  if (dueDate !== undefined) db.prepare("UPDATE capa SET dueDate = ? WHERE id = ?").run([dueDate, id]);
  if (status !== undefined) db.prepare("UPDATE capa SET status = ? WHERE id = ?").run([status, id]);
  if (priority !== undefined) db.prepare("UPDATE capa SET priority = ? WHERE id = ?").run([priority, id]);
  await saveDb(db);
  const updated = db.prepare("SELECT * FROM capa WHERE id = ?").getAsObject([id]);
  res.json(mapDoc(updated));
});

router.delete("/:id", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req: Request, res: Response) => {
  const id = routeParam(req, "id");

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("capa").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    await doc.ref.delete();
    return res.json({ ok: true, deleted: id });
  }

  const db = await getDb();
  const row = db.prepare("SELECT * FROM capa WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare("DELETE FROM capa WHERE id = ?").run([id]);
  await saveDb(db);
  res.json({ ok: true, deleted: id });
});

router.get("/overdue", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (_req: Request, res: Response) => {
  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const snap = await db.collection("capa")
      .where("status", "!=", "Verified")
      .where("dueDate", "<", new Date().toISOString())
      .get();
    return res.json(snap.docs.map((doc) => mapDoc(doc.data())));
  }

  const db = await getDb();
  const rows = allRows(db, "SELECT * FROM capa WHERE status != 'Verified' AND dueDate < ? ORDER BY dueDate ASC", [new Date().toISOString()]) as any[];
  res.json(rows.map(mapDoc));
});

router.post("/reminders", authMiddleware, requireRole("super-admin", "sheq-manager", "plant-manager", "factory-manager"), async (req: Request, res: Response) => {
  const { daysBefore } = req.body as { daysBefore?: number };
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (daysBefore || 3));

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const snap = await db.collection("capa")
      .where("status", "!=", "Verified")
      .where("dueDate", "==", targetDate.toISOString().split("T")[0])
      .get();

    const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    for (const capa of rows) {
      const capaData = capa as any;
      const incident = await db.collection("reports").doc(capaData.incidentId).get();
      if (incident.exists && (incident.data() as any)?.reporterEmail) {
        try {
          const { sendCapaReminder } = await import("../lib/email");
          await sendCapaReminder({
            to: (incident.data() as any).reporterEmail,
            phone: (incident.data() as any).reporterPhone,
            capaId: capaData.id,
            action: capaData.action,
            dueDate: capaData.dueDate,
          });
        } catch (e) {
          console.error("Failed to send reminder:", e);
        }
      }
    }
    return res.json({ sent: rows.length, message: `Reminders sent for ${rows.length} CAPA(s)` });
  }

  const db = await getDb();
  const rows = allRows(db, "SELECT * FROM capa WHERE status != 'Verified' AND date(dueDate) = date(?)", [targetDate.toISOString().split("T")[0]]) as any[];
  for (const capa of rows) {
    const reporterRow = allRows(db, "SELECT reporter, reporterEmail, reporterPhone FROM reports WHERE id = ?", [capa.incidentId])[0] as any;
    if (reporterRow?.reporterEmail) {
      try {
        const { sendCapaReminder } = await import("../lib/email");
        await sendCapaReminder({
          to: reporterRow.reporterEmail, phone: reporterRow.reporterPhone,
          capaId: capa.id, action: capa.action, dueDate: capa.dueDate,
        });
      } catch (e) { console.error("Failed to send reminder:", e); }
    }
  }
  res.json({ sent: rows.length, message: `Reminders sent for ${rows.length} CAPA(s)` });
});

export default router;