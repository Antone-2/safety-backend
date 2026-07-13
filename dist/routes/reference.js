import { Router } from "express";
import { listUsers, SUPERVISOR_ROLES } from "../lib/users.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { authenticateUser } from "../shared/middleware/auth.middleware.js";
const router = Router();
router.use(authenticateUser);
router.get("/users", async (_req, res) => {
    res.json(await listUsers());
});
router.get("/supervisors", async (_req, res) => {
    const result = await pgPool.query(`SELECT name FROM users
     WHERE active = TRUE AND role = ANY($1::text[])
     ORDER BY name`, [SUPERVISOR_ROLES]);
    res.json(result.rows.map((row) => row.name));
});
async function distinctReportValues(column) {
    const result = await pgPool.query(`SELECT DISTINCT ${column} FROM reports
     WHERE ${column} IS NOT NULL AND ${column} <> '' ORDER BY ${column}`);
    return result.rows.map((row) => row[column]);
}
router.get("/locations", async (_req, res) => {
    res.json(await distinctReportValues("location"));
});
router.get("/hazard-categories", async (_req, res) => {
    res.json(await distinctReportValues("category"));
});
router.get("/departments", async (_req, res) => {
    res.json(await distinctReportValues("department"));
});
router.get("/employees", async (_req, res) => {
    const result = await pgPool.query(`SELECT DISTINCT employee_name FROM training_records
     WHERE employee_name IS NOT NULL AND employee_name <> ''
     UNION
     SELECT DISTINCT employee_name FROM health_surveillance
     WHERE employee_name IS NOT NULL AND employee_name <> ''
     ORDER BY employee_name`);
    res.json(result.rows.map((row) => row.employee_name));
});
export default router;
