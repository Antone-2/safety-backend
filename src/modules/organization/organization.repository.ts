import { Pool } from "pg";
import type {
  CreateOrganizationDepartmentInput,
  CreateOrganizationSiteInput,
  OrganizationDepartment,
  OrganizationDepartmentFilters,
  OrganizationSite,
  OrganizationSiteFilters,
  OrganizationStats,
  OrganizationTreeNode,
  UpdateOrganizationDepartmentInput,
  UpdateOrganizationSiteInput,
} from "./organization.types.js";

const now = () => new Date().toISOString();

function asSite(row: Record<string, unknown>): OrganizationSite {
  return {
    id: String(row.id),
    code: row.code ? String(row.code) : undefined,
    name: String(row.name),
    region: row.region ? String(row.region) : undefined,
    country: row.country ? String(row.country) : undefined,
    managerName: row.manager_name ? String(row.manager_name) : undefined,
    escalationEmail: row.escalation_email ? String(row.escalation_email) : undefined,
    active: Boolean(row.active),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asDepartment(row: Record<string, unknown>): OrganizationDepartment {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    siteName: String(row.site_name),
    code: row.code ? String(row.code) : undefined,
    name: String(row.name),
    managerName: row.manager_name ? String(row.manager_name) : undefined,
    escalationEmail: row.escalation_email ? String(row.escalation_email) : undefined,
    active: Boolean(row.active),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class OrganizationRepository {
  constructor(private pool: Pool) {}

  async findSites(filters: OrganizationSiteFilters = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      where.push(`(name ILIKE $${idx} OR COALESCE(code, '') ILIKE $${idx} OR COALESCE(region, '') ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx += 1;
    }
    if (typeof filters.active === "boolean") {
      where.push(`active = $${idx}`);
      params.push(filters.active);
      idx += 1;
    }

    const result = await this.pool.query(
      `SELECT * FROM organization_sites ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY active DESC, name ASC`,
      params,
    );
    return result.rows.map((row) => asSite(row as Record<string, unknown>));
  }

  async findSiteById(id: string) {
    const result = await this.pool.query("SELECT * FROM organization_sites WHERE id = $1", [id]);
    return result.rows[0] ? asSite(result.rows[0] as Record<string, unknown>) : null;
  }

  async findSiteByName(name: string) {
    const result = await this.pool.query(
      "SELECT * FROM organization_sites WHERE lower(name) = lower($1) LIMIT 1",
      [name.trim()],
    );
    return result.rows[0] ? asSite(result.rows[0] as Record<string, unknown>) : null;
  }

  async createSite(input: CreateOrganizationSiteInput) {
    const result = await this.pool.query(
      `INSERT INTO organization_sites (
        id, code, name, region, country, manager_name, escalation_email, active, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *`,
      [
        input.code ?? null,
        input.name,
        input.region ?? null,
        input.country ?? null,
        input.managerName ?? null,
        input.escalationEmail ?? null,
        input.active ?? true,
        input.createdBy,
        now(),
        now(),
      ],
    );
    return asSite(result.rows[0] as Record<string, unknown>);
  }

  async updateSite(id: string, input: UpdateOrganizationSiteInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const add = (column: string, value: unknown) => {
      updates.push(`${column} = $${idx}`);
      params.push(value);
      idx += 1;
    };

    if (input.code !== undefined) add("code", input.code ?? null);
    if (input.name !== undefined) add("name", input.name);
    if (input.region !== undefined) add("region", input.region ?? null);
    if (input.country !== undefined) add("country", input.country ?? null);
    if (input.managerName !== undefined) add("manager_name", input.managerName ?? null);
    if (input.escalationEmail !== undefined) add("escalation_email", input.escalationEmail ?? null);
    if (input.active !== undefined) add("active", input.active);
    if (!updates.length) return this.findSiteById(id);
    add("updated_at", now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE organization_sites SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? asSite(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteSite(id: string) {
    const result = await this.pool.query("DELETE FROM organization_sites WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findDepartments(filters: OrganizationDepartmentFilters = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      where.push(`(d.name ILIKE $${idx} OR COALESCE(d.code, '') ILIKE $${idx} OR s.name ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx += 1;
    }
    if (filters.siteId) {
      where.push(`d.site_id = $${idx}`);
      params.push(filters.siteId);
      idx += 1;
    }
    if (typeof filters.active === "boolean") {
      where.push(`d.active = $${idx}`);
      params.push(filters.active);
      idx += 1;
    }

    const result = await this.pool.query(
      `SELECT d.*, s.name AS site_name
       FROM organization_departments d
       INNER JOIN organization_sites s ON s.id = d.site_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY s.name ASC, d.active DESC, d.name ASC`,
      params,
    );
    return result.rows.map((row) => asDepartment(row as Record<string, unknown>));
  }

  async findDepartmentById(id: string) {
    const result = await this.pool.query(
      `SELECT d.*, s.name AS site_name
       FROM organization_departments d
       INNER JOIN organization_sites s ON s.id = d.site_id
       WHERE d.id = $1`,
      [id],
    );
    return result.rows[0] ? asDepartment(result.rows[0] as Record<string, unknown>) : null;
  }

  async findDepartmentByName(name: string) {
    const result = await this.pool.query(
      `SELECT d.*, s.name AS site_name
       FROM organization_departments d
       INNER JOIN organization_sites s ON s.id = d.site_id
       WHERE lower(d.name) = lower($1)
       LIMIT 1`,
      [name.trim()],
    );
    return result.rows[0] ? asDepartment(result.rows[0] as Record<string, unknown>) : null;
  }

  async findDepartmentByNameForSite(name: string, siteName: string) {
    const result = await this.pool.query(
      `SELECT d.*, s.name AS site_name
       FROM organization_departments d
       INNER JOIN organization_sites s ON s.id = d.site_id
       WHERE lower(d.name) = lower($1) AND lower(s.name) = lower($2)
       LIMIT 1`,
      [name.trim(), siteName.trim()],
    );
    return result.rows[0] ? asDepartment(result.rows[0] as Record<string, unknown>) : null;
  }

  async createDepartment(input: CreateOrganizationDepartmentInput) {
    const result = await this.pool.query(
      `INSERT INTO organization_departments (
        id, site_id, code, name, manager_name, escalation_email, active, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id`,
      [
        input.siteId,
        input.code ?? null,
        input.name,
        input.managerName ?? null,
        input.escalationEmail ?? null,
        input.active ?? true,
        input.createdBy,
        now(),
        now(),
      ],
    );
    return this.findDepartmentById(String(result.rows[0]?.id));
  }

  async updateDepartment(id: string, input: UpdateOrganizationDepartmentInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const add = (column: string, value: unknown) => {
      updates.push(`${column} = $${idx}`);
      params.push(value);
      idx += 1;
    };

    if (input.siteId !== undefined) add("site_id", input.siteId);
    if (input.code !== undefined) add("code", input.code ?? null);
    if (input.name !== undefined) add("name", input.name);
    if (input.managerName !== undefined) add("manager_name", input.managerName ?? null);
    if (input.escalationEmail !== undefined) add("escalation_email", input.escalationEmail ?? null);
    if (input.active !== undefined) add("active", input.active);
    if (!updates.length) return this.findDepartmentById(id);
    add("updated_at", now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE organization_departments SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id`,
      params,
    );
    return result.rows[0] ? this.findDepartmentById(String(result.rows[0].id)) : null;
  }

  async deleteDepartment(id: string) {
    const result = await this.pool.query("DELETE FROM organization_departments WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getTree(): Promise<OrganizationTreeNode[]> {
    const [sites, departments] = await Promise.all([
      this.findSites({}),
      this.findDepartments({}),
    ]);

    return sites.map((site) => ({
      ...site,
      departments: departments.filter((department) => department.siteId === site.id),
    }));
  }

  async getStats(): Promise<OrganizationStats> {
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM organization_sites) AS sites,
        (SELECT COUNT(*)::int FROM organization_sites WHERE active = TRUE) AS active_sites,
        (SELECT COUNT(*)::int FROM organization_departments) AS departments,
        (SELECT COUNT(*)::int FROM organization_departments WHERE active = TRUE) AS active_departments
    `);
    return {
      sites: Number(result.rows[0]?.sites ?? 0),
      activeSites: Number(result.rows[0]?.active_sites ?? 0),
      departments: Number(result.rows[0]?.departments ?? 0),
      activeDepartments: Number(result.rows[0]?.active_departments ?? 0),
    };
  }

  async countUsersForSite(siteName: string) {
    const result = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE lower(site) = lower($1)",
      [siteName],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countUsersForDepartment(siteName: string, departmentName: string) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE lower(site) = lower($1) AND lower(department) = lower($2)`,
      [siteName, departmentName],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countDepartmentsForSite(siteId: string) {
    const result = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM organization_departments WHERE site_id = $1",
      [siteId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
