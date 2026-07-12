import { Router } from "express";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore } from "../lib/firebase.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { CreateRiskMatrixSchema, UpdateRiskMatrixSchema, RiskMatrixLevelSchema, } from "../lib/types.js";
const router = Router();
function parseLevels(value) {
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
function parseRecord(value) {
    if (!value)
        return {};
    if (typeof value === "object" && !Array.isArray(value)) {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            const n = Number(k);
            if (!Number.isNaN(n))
                result[n] = String(v);
        }
        return result;
    }
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return {};
        }
    }
    return {};
}
const mapDoc = (data) => ({
    id: data.id,
    name: data.name || "",
    description: data.description || undefined,
    likelihoodScale: parseRecord(data.likelihoodScale),
    severityScale: parseRecord(data.severityScale),
    levels: parseLevels(data.levels),
    isDefault: Boolean(data.isDefault),
    createdBy: data.createdBy || "",
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
});
const routeParam = (req, name) => {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : (value ?? "");
};
router.get("/", async (req, res) => {
    const isDefault = String(String(req.query.isDefault));
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        let query = db.collection("risk_matrices");
        if (isDefault !== undefined) {
            query = query.where("isDefault", "==", isDefault === "true");
        }
        const snap = await query.orderBy("createdAt", "desc").get();
        return res.json(snap.docs.map((doc) => mapDoc(doc.data())));
    }
    const db = await getDb();
    let sql = "SELECT * FROM risk_matrices WHERE 1=1";
    const params = [];
    if (isDefault !== undefined) {
        sql += " AND isDefault = ?";
        params.push(isDefault === "true" ? 1 : 0);
    }
    sql += " ORDER BY createdAt DESC";
    const rows = allRows(db, sql, params);
    res.json(rows.map(mapDoc));
});
router.get("/:id", async (req, res) => {
    const id = routeParam(req, "id");
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("risk_matrices").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        return res.json(mapDoc(doc.data()));
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(mapDoc(row));
});
router.post("/", async (req, res) => {
    const parsed = CreateRiskMatrixSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const now = new Date().toISOString();
    const normalizedLevels = parsed.data.levels.map((l) => ({
        ...l,
        minLikelihood: Math.min(l.minLikelihood, l.maxLikelihood),
        maxLikelihood: Math.max(l.minLikelihood, l.maxLikelihood),
        minSeverity: Math.min(l.minSeverity, l.maxSeverity),
        maxSeverity: Math.max(l.minSeverity, l.maxSeverity),
    }));
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("risk_matrices").get();
        const id = `RMT-${String(snap.size + 1).padStart(3, "0")}`;
        const matrix = {
            id,
            name: parsed.data.name,
            description: parsed.data.description || "",
            likelihoodScale: parsed.data.likelihoodScale,
            severityScale: parsed.data.severityScale,
            levels: normalizedLevels,
            isDefault: parsed.data.isDefault ? 1 : 0,
            createdBy: parsed.data.createdBy,
            createdAt: now,
            updatedAt: now,
        };
        await db.collection("risk_matrices").doc(id).set(sanitizeForFirestore(matrix));
        return res.status(201).json(mapDoc(matrix));
    }
    const db = await getDb();
    const countRow = db.prepare("SELECT COUNT(*) as c FROM risk_matrices").getAsObject();
    const count = Number(countRow.c ?? 0);
    const id = `RMT-${String(count + 1).padStart(3, "0")}`;
    const stmt = db.prepare(`INSERT INTO risk_matrices (id, name, description, likelihoodScale, severityScale, levels, isDefault, createdBy, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run([
        id,
        parsed.data.name,
        parsed.data.description || "",
        JSON.stringify(parsed.data.likelihoodScale),
        JSON.stringify(parsed.data.severityScale),
        JSON.stringify(normalizedLevels),
        parsed.data.isDefault ? 1 : 0,
        parsed.data.createdBy,
        now,
        now,
    ]);
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    await saveDb(db);
    res.status(201).json(mapDoc(row));
});
router.patch("/:id", async (req, res) => {
    const id = routeParam(req, "id");
    const parsed = UpdateRiskMatrixSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const now = new Date().toISOString();
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("risk_matrices").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const updates = { updatedAt: now };
        const data = parsed.data;
        if (data.name !== undefined)
            updates.name = data.name;
        if (data.description !== undefined)
            updates.description = data.description ?? "";
        if (data.likelihoodScale !== undefined)
            updates.likelihoodScale = data.likelihoodScale;
        if (data.severityScale !== undefined)
            updates.severityScale = data.severityScale;
        if (data.levels !== undefined) {
            updates.levels = data.levels.map((l) => ({
                ...l,
                minLikelihood: Math.min(l.minLikelihood, l.maxLikelihood),
                maxLikelihood: Math.max(l.minLikelihood, l.maxLikelihood),
                minSeverity: Math.min(l.minSeverity, l.maxSeverity),
                maxSeverity: Math.max(l.minSeverity, l.maxSeverity),
            }));
        }
        if (data.isDefault !== undefined)
            updates.isDefault = data.isDefault ? 1 : 0;
        await doc.ref.update(updates);
        const updated = mapDoc((await doc.ref.get()).data());
        return res.json(updated);
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const sets = ["updatedAt = ?"];
    const vals = [now];
    const data = parsed.data;
    if (data.name !== undefined) {
        sets.push("name = ?");
        vals.push(data.name);
    }
    if (data.description !== undefined) {
        sets.push("description = ?");
        vals.push(data.description ?? "");
    }
    if (data.likelihoodScale !== undefined) {
        sets.push("likelihoodScale = ?");
        vals.push(JSON.stringify(data.likelihoodScale));
    }
    if (data.severityScale !== undefined) {
        sets.push("severityScale = ?");
        vals.push(JSON.stringify(data.severityScale));
    }
    if (data.levels !== undefined) {
        const normalized = data.levels.map((l) => ({
            ...l,
            minLikelihood: Math.min(l.minLikelihood, l.maxLikelihood),
            maxLikelihood: Math.max(l.minLikelihood, l.maxLikelihood),
            minSeverity: Math.min(l.minSeverity, l.maxSeverity),
            maxSeverity: Math.max(l.minSeverity, l.maxSeverity),
        }));
        sets.push("levels = ?");
        vals.push(JSON.stringify(normalized));
    }
    if (data.isDefault !== undefined) {
        sets.push("isDefault = ?");
        vals.push(data.isDefault ? 1 : 0);
    }
    vals.push(id);
    db.prepare(`UPDATE risk_matrices SET ${sets.join(", ")} WHERE id = ?`).run(vals);
    await saveDb(db);
    const updated = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    res.json(mapDoc(updated));
});
router.delete("/:id", async (req, res) => {
    const id = routeParam(req, "id");
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("risk_matrices").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        await doc.ref.delete();
        return res.json({ ok: true, deleted: id });
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM risk_matrices WHERE id = ?").run([id]);
    await saveDb(db);
    res.json({ ok: true, deleted: id });
});
router.post("/:id/levels", async (req, res) => {
    const id = routeParam(req, "id");
    const level = req.body;
    const parsed = RiskMatrixLevelSchema.safeParse(level);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("risk_matrices").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const currentLevels = doc.data().levels || [];
        const newLevel = {
            ...parsed.data,
            minLikelihood: Math.min(parsed.data.minLikelihood, parsed.data.maxLikelihood),
            maxLikelihood: Math.max(parsed.data.minLikelihood, parsed.data.maxLikelihood),
            minSeverity: Math.min(parsed.data.minSeverity, parsed.data.maxSeverity),
            maxSeverity: Math.max(parsed.data.minSeverity, parsed.data.maxSeverity),
        };
        await doc.ref.update({ levels: [...currentLevels, newLevel], updatedAt: new Date().toISOString() });
        return res.json(mapDoc((await doc.ref.get()).data()));
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const currentLevels = parseLevels(row.levels);
    const newLevel = {
        ...parsed.data,
        minLikelihood: Math.min(parsed.data.minLikelihood, parsed.data.maxLikelihood),
        maxLikelihood: Math.max(parsed.data.minLikelihood, parsed.data.maxLikelihood),
        minSeverity: Math.min(parsed.data.minSeverity, parsed.data.maxSeverity),
        maxSeverity: Math.max(parsed.data.minSeverity, parsed.data.maxSeverity),
    };
    currentLevels.push(newLevel);
    db.prepare("UPDATE risk_matrices SET levels = ?, updatedAt = ? WHERE id = ?").run([JSON.stringify(currentLevels), new Date().toISOString(), id]);
    await saveDb(db);
    res.json(mapDoc({ ...row, levels: currentLevels }));
});
router.delete("/:id/levels/:levelLabel", async (req, res) => {
    const id = routeParam(req, "id");
    const levelLabel = decodeURIComponent(routeParam(req, "levelLabel"));
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("risk_matrices").doc(id).get();
        if (!doc.exists)
            return res.status(404).json({ error: "Not found" });
        const currentLevels = (doc.data().levels || []).filter((l) => l.label !== levelLabel);
        await doc.ref.update({ levels: currentLevels, updatedAt: new Date().toISOString() });
        return res.json(mapDoc((await doc.ref.get()).data()));
    }
    const db = await getDb();
    const row = db.prepare("SELECT * FROM risk_matrices WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const currentLevels = parseLevels(row.levels).filter((l) => l.label !== levelLabel);
    db.prepare("UPDATE risk_matrices SET levels = ?, updatedAt = ? WHERE id = ?").run([JSON.stringify(currentLevels), new Date().toISOString(), id]);
    await saveDb(db);
    res.json(mapDoc({ ...row, levels: currentLevels }));
});
export default router;
