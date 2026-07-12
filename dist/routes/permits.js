import { Router } from "express";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore } from "../lib/firebase.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { CreatePermitSchema, UpdatePermitSchema, AdvancePermitStatusSchema, } from "../lib/types.js";
const router = Router();
const PERMIT_STATUS_ORDER = [
    "applicant",
    "supervisor",
    "EHS",
    "issuer",
    "approval",
    "active",
    "closed",
];
function parseAttachments(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return [];
        }
    }
    return [];
}
function parseComments(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return [];
        }
    }
    return [];
}
function parsePpe(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return [];
        }
    }
    return [];
}
const mapDoc = (data) => ({
    id: data.id,
    type: data.type || "General",
    status: data.status || "applicant",
    location: data.location || "",
    applicant: data.applicant || "",
    applicantContact: data.applicantContact || undefined,
    supervisor: data.supervisor || undefined,
    EHSOfficer: data.EHSOfficer || undefined,
    issuer: data.issuer || undefined,
    approver: data.approver || undefined,
    description: data.description || "",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    hazards: data.hazards || undefined,
    precautions: data.precautions || undefined,
    ppeRequired: parsePpe(data.ppeRequired),
    isolationRequired: Boolean(data.isolationRequired),
    isolationDetails: data.isolationDetails || undefined,
    fireWatchRequired: Boolean(data.fireWatchRequired),
    gasTestRequired: Boolean(data.gasTestRequired),
    gasTestResult: data.gasTestResult || undefined,
    attachments: parseAttachments(data.attachments),
    comments: parseComments(data.comments),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
});
const routeParam = (req, name) => {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : (value ?? "");
};
function canAdvanceStatus(current, next) {
    const currentIdx = PERMIT_STATUS_ORDER.indexOf(current);
    const nextIdx = PERMIT_STATUS_ORDER.indexOf(next);
    if (nextIdx === -1)
        return false;
    return nextIdx >= currentIdx;
}
router.get("/", async (req, res) => {
    const type = String(String(req.query.type));
    const status = String(String(req.query.status));
    const location = String(String(req.query.location));
    const applicant = String(String(req.query.applicant));
    const fromDate = String(String(req.query.fromDate));
    const toDate = String(String(req.query.toDate));
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        let query = db.collection("permits");
        if (type)
            query = query.where("type", "==", type);
        if (status)
            query = query.where("status", "==", status);
        if (location)
            query = query.where("location", "==", location);
        if (applicant)
            query = query.where("applicant", "==", applicant);
        const snap = await query.orderBy("createdAt", "desc").get();
        let docs = snap.docs.map((doc) => mapDoc(doc.data()));
        if (fromDate) {
            docs = docs.filter((p) => p.startDate >= fromDate);
        }
        if (toDate) {
            docs = docs.filter((p) => p.endDate <= toDate);
        }
        return res.json(docs);
    }
    const db = await getDb();
    let sql = "SELECT * FROM permits WHERE 1=1";
    const params = [];
    if (type) {
        sql += " AND type = ?";
        params.push(type);
    }
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }
    if (location) {
        sql += " AND location = ?";
        params.push(location);
    }
    if (applicant) {
        sql += " AND applicant = ?";
        params.push(applicant);
    }
    if (fromDate) {
        sql += " AND startDate >= ?";
        params.push(fromDate);
    }
    if (toDate) {
        sql += " AND endDate <= ?";
        params.push(toDate);
    }
    sql += " ORDER BY createdAt DESC";
    const rows = allRows(db, sql, params);
    res.json(rows.map(mapDoc));
});
router.get("/:id", async (req, res) => {
    const id = routeParam(req, "id");
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("permits").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        return res.json(mapDoc(doc.data()));
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(mapDoc(row));
});
router.post("/", async (req, res) => {
    const parsed = CreatePermitSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const now = new Date().toISOString();
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("permits").get();
        const count = snap.size;
        const id = `PMT-${String(400 + count).padStart(3, "0")}`;
        const permit = {
            id,
            type: parsed.data.type,
            status: "applicant",
            location: parsed.data.location,
            applicant: parsed.data.applicant,
            applicantContact: parsed.data.applicantContact || "",
            supervisor: parsed.data.supervisor || "",
            EHSOfficer: parsed.data.EHSOfficer || "",
            issuer: parsed.data.issuer || "",
            approver: parsed.data.approver || "",
            description: parsed.data.description,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            hazards: parsed.data.hazards || "",
            precautions: parsed.data.precautions || "",
            ppeRequired: parsed.data.ppeRequired || [],
            isolationRequired: parsed.data.isolationRequired ? 1 : 0,
            isolationDetails: parsed.data.isolationDetails || "",
            fireWatchRequired: parsed.data.fireWatchRequired ? 1 : 0,
            gasTestRequired: parsed.data.gasTestRequired ? 1 : 0,
            gasTestResult: "",
            attachments: [],
            comments: [],
            createdAt: now,
            updatedAt: now,
        };
        await db.collection("permits").doc(id).set(sanitizeForFirestore(permit));
        return res.status(201).json(mapDoc(permit));
    }
    const db = await getDb();
    const countRow = db.prepare("SELECT COUNT(*) as c FROM permits").getAsObject();
    const count = Number(countRow.c ?? 0);
    const id = `PMT-${String(400 + count).padStart(3, "0")}`;
    const stmt = db.prepare(`INSERT INTO permits (id, type, status, location, applicant, applicantContact, supervisor, EHSOfficer, issuer, approver, description, startDate, endDate, hazards, precautions, ppeRequired, isolationRequired, isolationDetails, fireWatchRequired, gasTestRequired, gasTestResult, attachments, comments, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run([
        id,
        parsed.data.type,
        "applicant",
        parsed.data.location,
        parsed.data.applicant,
        parsed.data.applicantContact || "",
        parsed.data.supervisor || "",
        parsed.data.EHSOfficer || "",
        parsed.data.issuer || "",
        parsed.data.approver || "",
        parsed.data.description,
        parsed.data.startDate,
        parsed.data.endDate,
        parsed.data.hazards || "",
        parsed.data.precautions || "",
        JSON.stringify(parsed.data.ppeRequired || []),
        parsed.data.isolationRequired ? 1 : 0,
        parsed.data.isolationDetails || "",
        parsed.data.fireWatchRequired ? 1 : 0,
        parsed.data.gasTestRequired ? 1 : 0,
        "",
        "[]",
        "[]",
        now,
        now,
    ]);
    const row = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    await saveDb(db);
    res.status(201).json(mapDoc(row));
});
router.patch("/:id/status", async (req, res) => {
    const parsed = AdvancePermitStatusSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const id = routeParam(req, "id");
    const newStatus = parsed.data.status;
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("permits").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const current = doc.data().status || "applicant";
        if (!canAdvanceStatus(current, newStatus)) {
            return res.status(400).json({ error: `Invalid status transition from ${current} to ${newStatus}` });
        }
        await doc.ref.update({ status: newStatus, updatedAt: new Date().toISOString() });
        const updated = mapDoc((await doc.ref.get()).data());
        return res.json(updated);
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const current = row.status || "applicant";
    if (!canAdvanceStatus(current, newStatus)) {
        return res.status(400).json({ error: `Invalid status transition from ${current} to ${newStatus}` });
    }
    db.prepare("UPDATE permits SET status = ?, updatedAt = ? WHERE id = ?").run([newStatus, new Date().toISOString(), id]);
    await saveDb(db);
    const updated = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    res.json(mapDoc(updated));
});
router.patch("/:id", async (req, res) => {
    const id = routeParam(req, "id");
    const parsed = UpdatePermitSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const now = new Date().toISOString();
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("permits").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const updates = { updatedAt: now };
        const data = parsed.data;
        if (data.type !== undefined)
            updates.type = data.type;
        if (data.location !== undefined)
            updates.location = data.location;
        if (data.applicant !== undefined)
            updates.applicant = data.applicant;
        if (data.applicantContact !== undefined)
            updates.applicantContact = data.applicantContact || "";
        if (data.supervisor !== undefined)
            updates.supervisor = data.supervisor || "";
        if (data.EHSOfficer !== undefined)
            updates.EHSOfficer = data.EHSOfficer || "";
        if (data.issuer !== undefined)
            updates.issuer = data.issuer || "";
        if (data.approver !== undefined)
            updates.approver = data.approver || "";
        if (data.description !== undefined)
            updates.description = data.description;
        if (data.startDate !== undefined)
            updates.startDate = data.startDate;
        if (data.endDate !== undefined)
            updates.endDate = data.endDate;
        if (data.hazards !== undefined)
            updates.hazards = data.hazards || "";
        if (data.precautions !== undefined)
            updates.precautions = data.precautions || "";
        if (data.ppeRequired !== undefined)
            updates.ppeRequired = data.ppeRequired || [];
        if (data.isolationRequired !== undefined)
            updates.isolationRequired = data.isolationRequired ? 1 : 0;
        if (data.isolationDetails !== undefined)
            updates.isolationDetails = data.isolationDetails || "";
        if (data.fireWatchRequired !== undefined)
            updates.fireWatchRequired = data.fireWatchRequired ? 1 : 0;
        if (data.gasTestRequired !== undefined)
            updates.gasTestRequired = data.gasTestRequired ? 1 : 0;
        if (data.gasTestResult !== undefined)
            updates.gasTestResult = data.gasTestResult || "";
        await doc.ref.update(updates);
        const updated = mapDoc((await doc.ref.get()).data());
        return res.json(updated);
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const sets = ["updatedAt = ?"];
    const vals = [now];
    const data = parsed.data;
    if (data.type !== undefined) {
        sets.push("type = ?");
        vals.push(data.type);
    }
    if (data.location !== undefined) {
        sets.push("location = ?");
        vals.push(data.location);
    }
    if (data.applicant !== undefined) {
        sets.push("applicant = ?");
        vals.push(data.applicant);
    }
    if (data.applicantContact !== undefined) {
        sets.push("applicantContact = ?");
        vals.push(data.applicantContact ?? "");
    }
    if (data.supervisor !== undefined) {
        sets.push("supervisor = ?");
        vals.push(data.supervisor ?? "");
    }
    if (data.EHSOfficer !== undefined) {
        sets.push("EHSOfficer = ?");
        vals.push(data.EHSOfficer ?? "");
    }
    if (data.issuer !== undefined) {
        sets.push("issuer = ?");
        vals.push(data.issuer ?? "");
    }
    if (data.approver !== undefined) {
        sets.push("approver = ?");
        vals.push(data.approver ?? "");
    }
    if (data.description !== undefined) {
        sets.push("description = ?");
        vals.push(data.description);
    }
    if (data.startDate !== undefined) {
        sets.push("startDate = ?");
        vals.push(data.startDate);
    }
    if (data.endDate !== undefined) {
        sets.push("endDate = ?");
        vals.push(data.endDate);
    }
    if (data.hazards !== undefined) {
        sets.push("hazards = ?");
        vals.push(data.hazards ?? "");
    }
    if (data.precautions !== undefined) {
        sets.push("precautions = ?");
        vals.push(data.precautions ?? "");
    }
    if (data.ppeRequired !== undefined) {
        sets.push("ppeRequired = ?");
        vals.push(JSON.stringify(data.ppeRequired || []));
    }
    if (data.isolationRequired !== undefined) {
        sets.push("isolationRequired = ?");
        vals.push(data.isolationRequired ? 1 : 0);
    }
    if (data.isolationDetails !== undefined) {
        sets.push("isolationDetails = ?");
        vals.push(data.isolationDetails ?? "");
    }
    if (data.fireWatchRequired !== undefined) {
        sets.push("fireWatchRequired = ?");
        vals.push(data.fireWatchRequired ? 1 : 0);
    }
    if (data.gasTestRequired !== undefined) {
        sets.push("gasTestRequired = ?");
        vals.push(data.gasTestRequired ? 1 : 0);
    }
    if (data.gasTestResult !== undefined) {
        sets.push("gasTestResult = ?");
        vals.push(data.gasTestResult ?? "");
    }
    vals.push(id);
    db.prepare(`UPDATE permits SET ${sets.join(", ")} WHERE id = ?`).run(vals);
    await saveDb(db);
    const updated = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    res.json(mapDoc(updated));
});
router.post("/:id/attachments", async (req, res) => {
    const id = routeParam(req, "id");
    const { name, url, uploadedBy } = req.body;
    if (!name || !url || !uploadedBy) {
        return res.status(400).json({ error: "name, url, and uploadedBy are required" });
    }
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("permits").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const current = doc.data().attachments || [];
        const attachment = { name, url, uploadedAt: new Date().toISOString(), uploadedBy };
        await doc.ref.update({ attachments: [...current, attachment], updatedAt: new Date().toISOString() });
        return res.json(mapDoc((await doc.ref.get()).data()));
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM permits WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const current = parseAttachments(row.attachments);
    const attachment = { name, url, uploadedAt: new Date().toISOString(), uploadedBy };
    const updated = [...current, attachment];
    db.prepare("UPDATE permits SET attachments = ?, updatedAt = ? WHERE id = ?").run([JSON.stringify(updated), new Date().toISOString(), id]);
    await saveDb(db);
    res.json(mapDoc({ ...row, attachments: updated }));
});
export default router;
