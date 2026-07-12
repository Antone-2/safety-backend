import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync } from "fs";
import { readFileSync } from "fs";
function readServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!saPath || !existsSync(saPath)) {
        console.error("Firebase service account is not configured. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.");
        process.exit(1);
    }
    return JSON.parse(readFileSync(saPath, "utf-8"));
}
const app = initializeApp({ credential: cert(readServiceAccount()) });
const db = getFirestore(app);
// Test supervisors -> appear in the "To" dropdown AND receive admin notifications
// if their role is in the assigning/admin set.
const supervisors = [
    { name: "Sup. Mwangi (Plant Manager)", email: "mwangi.plant@crownpaints.test", role: "plant-manager", phone: "+254711000101" },
    { name: "Sup. Achieng (GM)", email: "achieng.gm@crownpaints.test", role: "gm", phone: "+254711000102" },
    { name: "Sup. Kamau (EHS Manager)", email: "kamau.EHS@crownpaints.test", role: "EHS-manager", phone: "+254711000103" },
    { name: "Sup. Wanjiku (Factory Manager)", email: "wanjiku.factory@crownpaints.test", role: "factory-manager", phone: "+254711000104" },
    { name: "Sup. Otieno (Depot Admin)", email: "otieno.depot@crownpaints.test", role: "depot-admin", phone: "+254711000105" },
];
// Other recipients for "Cc" -> appear in the copy list (reference/employees reads
// reporter/assignedTo from reports).
const recipients = [
    { name: "CC. Otieno (HSE Officer)", email: "otieno.hse@crownpaints.test", phone: "+254722000201" },
    { name: "CC. Wanjiru (Safety Coordinator)", email: "wanjiru.safety@crownpaints.test", phone: "+254722000202" },
    { name: "CC. Njeri (Line Manager)", email: "njeri.line@crownpaints.test", phone: "+254722000203" },
    { name: "CC. Kiptoo (Shift Supervisor)", email: "kiptoo.shift@crownpaints.test", phone: "+254722000204" },
];
async function main() {
    // Clear previous test data so re-running stays idempotent.
    const oldUsers = await db.collection("users").listDocuments();
    for (const doc of oldUsers) {
        if (doc.id.startsWith("test-user-"))
            await doc.delete();
    }
    const oldReports = await db.collection("reports").listDocuments();
    for (const doc of oldReports) {
        if (doc.id.startsWith("RPT-TEST-"))
            await doc.delete();
    }
    let seededUsers = 0;
    for (const s of supervisors) {
        const id = `test-user-${s.role}-${Math.random().toString(36).slice(2, 7)}`;
        await db
            .collection("users")
            .doc(id)
            .set({
            name: s.name,
            email: s.email,
            role: s.role,
            phone: s.phone,
            passwordHash: "seeded-test-user",
            createdAt: new Date().toISOString(),
        });
        seededUsers += 1;
    }
    // A known test admin we can authenticate as, to verify the "notify admin back"
    // branch of the assignment flow.
    const bcrypt = await import("bcryptjs");
    const adminPasswordHash = await bcrypt.hash("Test@1234", 10);
    await db
        .collection("users")
        .doc("test-user-admin")
        .set({
        name: "Test Admin",
        email: "test.admin@crownpaints.test",
        role: "super-admin",
        phone: "+254733000301",
        passwordHash: adminPasswordHash,
        createdAt: new Date().toISOString(),
    });
    seededUsers += 1;
    let seededReports = 0;
    for (const r of recipients) {
        const id = `RPT-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await db
            .collection("reports")
            .doc(id)
            .set({
            id,
            source: "manual",
            date: new Date().toISOString(),
            location: "Mombasa - Factory",
            reporter: r.name,
            reporterEmail: r.email,
            reporterPhone: r.phone,
            description: `Test report created to seed copy recipient ${r.name}`,
            severity: "Medium",
            status: "Open",
            category: "Slip / Trip",
            type: "Unsafe Condition",
            slaHours: 168,
            dueAt: new Date(Date.now() + 168 * 3600000).toISOString(),
            isNearMiss: false,
            anonymous: 0,
            department: "Production",
            shift: "Day",
            complianceRequired: 0,
            photoUrl: "",
            comments: [],
            assignedTo: "",
            assignedToCopy: "[]",
        });
        seededReports += 1;
    }
    console.log(`Seeded ${seededUsers} test supervisors and ${seededReports} test recipient reports.`);
}
main()
    .then(() => process.exit(0))
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
