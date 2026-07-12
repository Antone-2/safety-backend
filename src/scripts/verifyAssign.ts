import jwt from "jsonwebtoken";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running verifyAssign`);
  return value;
}

const BASE = requireEnv("VERIFY_ASSIGN_BASE_URL");
const SECRET = requireEnv("JWT_SECRET");

async function main() {
  const token = jwt.sign(
    { userId: "test-user-admin", email: "test.admin@crownpaints.test", name: "Test Admin", role: "super-admin" },
    SECRET,
    { expiresIn: "1h" },
  );

  const reports = await (await fetch(`${BASE}/api/reports?limit=1`)).json();
  const rid = reports.data[0].id;
  console.log("Assigning report", rid, "as admin test.admin@crownpaints.test");

  const body = {
    assignedTo: "mwangi.plant@crownpaints.test",
    assignedToCopy: ["otieno.hse@crownpaints.test", "wanjiru.safety@crownpaints.test"],
    assignedBy: "test.admin@crownpaints.test",
  };

  const res = await fetch(`${BASE}/api/reports/${rid}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  console.log("PATCH status:", res.status);

  const notifications = await (await fetch(`${BASE}/api/notifications`)).json();
  const forReport = notifications.filter(
    (n: any) => n.reportId === rid && (n.subject || "").startsWith("Task assigned"),
  );
  console.log("\nNotifications for this assignment:");
  for (const n of forReport) {
    console.log(` - ${n.recipient}  [${n.channel}]`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
