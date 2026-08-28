import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function mapUser(row) {
    const active = row.active === true;
    const lockedUntil = row.locked_until ? String(row.locked_until) : undefined;
    const delegatedUntil = row.delegated_until ? String(row.delegated_until) : undefined;
    const delegatedToUserId = row.delegated_to_user_id
        ? String(row.delegated_to_user_id)
        : undefined;
    const isLocked = Boolean(lockedUntil && Date.parse(lockedUntil) > Date.now());
    const isDelegated = Boolean(delegatedToUserId) &&
        Boolean(delegatedUntil && Date.parse(delegatedUntil) > Date.now());
    return {
        id: String(row.id),
        email: String(row.email),
        name: String(row.name),
        role: String(row.role),
        phone: row.phone ? String(row.phone) : undefined,
        site: row.site ? String(row.site) : undefined,
        department: row.department ? String(row.department) : undefined,
        employeeNo: row.employee_no ? String(row.employee_no) : undefined,
        jobTitle: row.job_title ? String(row.job_title) : undefined,
        lineManagerId: row.line_manager_id ? String(row.line_manager_id) : undefined,
        lineManagerName: row.line_manager_name ? String(row.line_manager_name) : undefined,
        supervisorId: row.supervisor_id ? String(row.supervisor_id) : undefined,
        supervisorName: row.supervisor_name ? String(row.supervisor_name) : undefined,
        delegatedToUserId,
        delegatedToUserName: row.delegated_to_user_name
            ? String(row.delegated_to_user_name)
            : undefined,
        delegatedFrom: row.delegated_from ? String(row.delegated_from) : undefined,
        delegatedUntil,
        active,
        lockedUntil,
        lastLoginAt: row.last_login_at ? String(row.last_login_at) : undefined,
        status: !active ? "Inactive" : isLocked ? "Locked" : isDelegated ? "Delegated" : "Active",
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class UsersRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    baseSelect() {
        return `
      SELECT
        u.id::text,
        u.email,
        u.name,
        u.role,
        u.phone,
        u.site,
        u.department,
        u.employee_no,
        u.job_title,
        u.line_manager_id::text,
        manager.name AS line_manager_name,
        u.supervisor_id::text,
        supervisor.name AS supervisor_name,
        u.delegated_to_user_id::text,
        delegate.name AS delegated_to_user_name,
        u.delegated_from,
        u.delegated_until,
        u.active,
        u.locked_until,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN users manager ON manager.id = u.line_manager_id
      LEFT JOIN users supervisor ON supervisor.id = u.supervisor_id
      LEFT JOIN users delegate ON delegate.id = u.delegated_to_user_id
    `;
    }
    async findAll(filters = {}) {
        const where = [];
        const params = [];
        const add = (clause, value) => {
            params.push(value);
            where.push(clause.replace("?", `$${params.length}`));
        };
        if (filters.search) {
            add(`(u.name ILIKE ? OR u.email ILIKE ? OR COALESCE(u.site, '') ILIKE ? OR COALESCE(u.department, '') ILIKE ? OR COALESCE(u.employee_no, '') ILIKE ?)`, `%${filters.search}%`);
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            where[where.length - 1] = `(u.name ILIKE $${params.length - 4} OR u.email ILIKE $${params.length - 3} OR COALESCE(u.site, '') ILIKE $${params.length - 2} OR COALESCE(u.department, '') ILIKE $${params.length - 1} OR COALESCE(u.employee_no, '') ILIKE $${params.length})`;
        }
        if (filters.role)
            add(`u.role = ?`, filters.role);
        if (filters.site)
            add(`u.site = ?`, filters.site);
        if (filters.department)
            add(`u.department = ?`, filters.department);
        if (typeof filters.active === "boolean")
            add(`u.active = ?`, filters.active);
        if (filters.lineManagerId)
            add(`u.line_manager_id = ?`, filters.lineManagerId);
        if (filters.supervisorId)
            add(`u.supervisor_id = ?`, filters.supervisorId);
        const result = await this.pool.query(`${this.baseSelect()} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY u.created_at DESC`, params);
        return result.rows.map((row) => mapUser(row));
    }
    async findById(id) {
        const result = await this.pool.query(`${this.baseSelect()} WHERE u.id = $1 LIMIT 1`, [id]);
        return result.rows[0]
            ? mapUser(result.rows[0])
            : null;
    }
    async findByEmail(email) {
        const result = await this.pool.query(`${this.baseSelect()} WHERE lower(u.email) = $1 LIMIT 1`, [normalizeEmail(email)]);
        return result.rows[0]
            ? mapUser(result.rows[0])
            : null;
    }
    async create(input) {
        const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
        const result = await this.pool.query(`INSERT INTO users (
        email,
        password_hash,
        name,
        role,
        phone,
        site,
        department,
        employee_no,
        job_title,
        line_manager_id,
        supervisor_id,
        active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id::text`, [
            normalizeEmail(input.email),
            passwordHash,
            input.name,
            input.role,
            input.phone ?? null,
            input.site ?? null,
            input.department ?? null,
            input.employeeNo ?? null,
            input.jobTitle ?? null,
            input.lineManagerId ?? null,
            input.supervisorId ?? null,
            input.active ?? true,
        ]);
        return this.findById(String(result.rows[0]?.id));
    }
    async update(id, input) {
        const updates = [];
        const params = [];
        const add = (column, value) => {
            params.push(value);
            updates.push(`${column} = $${params.length}`);
        };
        if (input.email !== undefined)
            add("email", normalizeEmail(input.email));
        if (input.name !== undefined)
            add("name", input.name);
        if (input.role !== undefined)
            add("role", input.role);
        if (input.phone !== undefined)
            add("phone", input.phone ?? null);
        if (input.site !== undefined)
            add("site", input.site ?? null);
        if (input.department !== undefined)
            add("department", input.department ?? null);
        if (input.employeeNo !== undefined)
            add("employee_no", input.employeeNo ?? null);
        if (input.jobTitle !== undefined)
            add("job_title", input.jobTitle ?? null);
        if (input.lineManagerId !== undefined)
            add("line_manager_id", input.lineManagerId ?? null);
        if (input.supervisorId !== undefined)
            add("supervisor_id", input.supervisorId ?? null);
        if (input.active !== undefined)
            add("active", input.active);
        add("updated_at", new Date().toISOString());
        params.push(id);
        await this.pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);
        return this.findById(id);
    }
    async setActive(id, active) {
        await this.pool.query(`UPDATE users
       SET active = $1,
           updated_at = NOW(),
           delegated_to_user_id = CASE WHEN $1 THEN delegated_to_user_id ELSE NULL END,
           delegated_from = CASE WHEN $1 THEN delegated_from ELSE NULL END,
           delegated_until = CASE WHEN $1 THEN delegated_until ELSE NULL END
       WHERE id = $2`, [active, id]);
        if (!active) {
            await this.pool.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
        }
        return this.findById(id);
    }
    async setDelegation(id, input) {
        await this.pool.query(`UPDATE users
       SET delegated_to_user_id = $1,
           delegated_from = $2,
           delegated_until = $3,
           updated_at = NOW()
       WHERE id = $4`, [input.delegatedToUserId, input.delegatedFrom, input.delegatedUntil, id]);
        return this.findById(id);
    }
    async clearDelegation(id) {
        await this.pool.query(`UPDATE users
       SET delegated_to_user_id = NULL,
           delegated_from = NULL,
           delegated_until = NULL,
           updated_at = NOW()
       WHERE id = $1`, [id]);
        return this.findById(id);
    }
    async findAuditTrail(id) {
        const result = await this.pool.query(`SELECT
         id::text,
         actor_id::text,
         actor_email,
         actor_role,
         action,
         resource_type,
         resource_id,
         changes,
         context,
         ip_address,
         user_agent,
         created_at
       FROM audit_logs
       WHERE resource_type = 'user' AND resource_id = $1
       ORDER BY created_at DESC
       LIMIT 200`, [id]);
        return result.rows;
    }
}
