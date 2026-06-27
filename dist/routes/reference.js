import { Router } from "express";
import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";
import { allRows, getDb } from "../lib/database.js";
const router = Router();
router.get("/locations", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("reports").get();
        return res.json([...new Set(snap.docs.map((doc) => doc.data().location))].sort());
    }
    const db = await getDb();
    return res.json(allRows(db, "SELECT DISTINCT location FROM reports ORDER BY location").map((r) => r.location));
});
router.get("/hazard-categories", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("reports").get();
        return res.json([...new Set(snap.docs.map((doc) => doc.data().category))].sort());
    }
    const db = await getDb();
    return res.json(allRows(db, "SELECT DISTINCT category FROM reports ORDER BY category").map((r) => r.category));
});
router.get("/departments", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("reports").get();
        return res.json([...new Set(snap.docs.map((doc) => doc.data().department))].sort());
    }
    const db = await getDb();
    return res.json(allRows(db, "SELECT DISTINCT department FROM reports ORDER BY department").map((r) => r.department));
});
router.get("/supervisors", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("users").get();
        const names = snap.docs
            .map((doc) => doc.data().name)
            .filter((name) => Boolean(name));
        return res.json(names.sort());
    }
    const db = await getDb();
    return res.json(allRows(db, "SELECT name FROM users WHERE role IN ('super-admin','gm','sheq-manager','plant-manager','factory-manager','depot-admin') ORDER BY name").map((r) => r.name));
});
router.get("/employees", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const snap = await db.collection("reports").get();
        const names = new Set();
        snap.forEach((doc) => {
            const d = doc.data();
            if (d.assignedTo)
                names.add(d.assignedTo);
            if (d.reporter && d.reporter !== "Anonymous")
                names.add(d.reporter);
        });
        return res.json([...names].sort());
    }
    const db = await getDb();
    const rows = allRows(db, "SELECT DISTINCT assignedTo as name FROM reports WHERE assignedTo IS NOT NULL UNION SELECT DISTINCT reporter as name FROM reports WHERE reporter IS NOT NULL ORDER BY name");
    return res.json(rows.map((r) => r.name).filter(Boolean));
});
export default router;
