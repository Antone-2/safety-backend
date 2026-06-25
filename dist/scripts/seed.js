import { getDb, saveDb } from "../lib/database";
async function seed() {
    const db = await getDb();
    const now = Date.now();
    const rows = [
        ["Likoni - Head Office & Warehouse", "James Mutua", "Worker observed bypassing machine guard during mixing process.", "Critical", "Open", "Slip / Trip", "Unsafe Act", "Production", "Day"],
        ["Mombasa - Factory", "Mary Wairimu", "Chemical drum found with damaged seal and no secondary containment.", "High", "In Progress", "Chemical Spill", "Unsafe Condition", "Warehouse", "Night"],
        ["Nakuru - Depot", "John Okeyo", "Two workers on production line without high-visibility vests.", "Medium", "Open", "PPE Violation", "Unsafe Act", "Production", "Day"],
        ["Kisumu - Depot", "Patricia Cheruiyot", "Exposed live wire near panel board with no lock-out tag-out in place.", "Critical", "Open", "Electrical", "Unsafe Condition", "Maintenance", "Day"],
        ["Eldoret - Depot", "Robert Kamau", "Steel pipe fell from overhead rack; near miss to worker below.", "High", "In Progress", "Falling Object", "Unsafe Condition", "Warehouse", "Swing"],
        ["Sinai - Export Warehouse", "Jennifer Njeri", "Forklift operating without sounding horn at blind corner.", "Medium", "Open", "Vehicle / Forklift", "Unsafe Act", "Logistics", "Day"],
        ["Likoni - Head Office & Warehouse", "Michael Kipchoge", "Strong solvent fumes reported in mixing bay; ventilation inadequate.", "High", "Closed", "Inhalation / Fumes", "Unsafe Condition", "Production", "Night"],
        ["Mombasa - Factory", "Linda Achieng", "Hot-work permit expired but welding still in progress.", "Critical", "In Progress", "Fire / Ignition", "Unsafe Act", "Maintenance", "Day"],
        ["Kisian - Factory", "David Mwaniki", "Repeated manual lifting of 25kg bags without mechanical assist.", "Low", "Open", "Manual Handling", "Unsafe Act", "Production", "Day"],
        ["Westlands - Showroom", "Elizabeth Fadhili", "Noise levels exceeded 85 dB in packaging hall; hearing protection not worn.", "Medium", "Closed", "Noise Exposure", "Unsafe Condition", "Production", "Swing"],
    ];
    for (let i = 0; i < rows.length; i++) {
        const [location, reporter, description, severity, status, category, type, department, shift] = rows[i];
        const id = `RPT-${String(i + 1).padStart(5, "0")}`;
        const date = new Date(now - Math.floor(Math.random() * 30) * 86400000).toISOString();
        const dueDate = new Date(new Date(date).getTime() + (severity === "Critical" ? 1 : severity === "High" ? 3 : 7) * 86400000);
        const slaHours = severity === "Critical" ? 24 : severity === "High" ? 72 : 168;
        const resolutionDays = status === "Closed" ? Math.floor(Math.random() * 12) + 1 : undefined;
        const assignedTo = status === "Closed" || status === "In Progress" ? ["Eng. Mutua", "Ms. Wairimu", "Mr. Okeyo", "Eng. Cheruiyot"][i % 4] : undefined;
        const isNearMiss = Math.random() < 0.25 ? 1 : 0;
        const anonymous = Math.random() < 0.2 ? 1 : 0;
        const complianceRequired = severity === "Critical" || severity === "High" ? 1 : 0;
        const complianceDueAt = complianceRequired ? new Date(dueDate.getTime() + 86400000 * 3).toISOString() : null;
        const photoUrl = `https://placehold.co/80x80/1e293b/ffffff?text=${id.slice(-3)}`;
        db.prepare(`
      INSERT OR REPLACE INTO reports (id, date, location, reporter, description, severity, status, category, type, resolutionDays, slaHours, dueAt, assignedTo, isNearMiss, anonymous, department, shift, complianceRequired, complianceDueAt, photoUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([id, date, location, reporter, description, severity, status, category, type, resolutionDays, slaHours, dueDate.toISOString(), assignedTo, isNearMiss, anonymous, department, shift, complianceRequired, complianceDueAt, photoUrl]);
    }
    await saveDb(db);
    console.log("Seeded", rows.length, "reports");
}
seed().catch((e) => { console.error(e); process.exit(1); });
