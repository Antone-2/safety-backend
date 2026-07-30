import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
const now = () => new Date().toISOString();
const fallbackObligations = [
    {
        id: "OBS-1",
        title: "ISO 45001 Clause 4",
        legislation: "ISO 45001",
        requirement: "Context of organization",
        frequency: "Annual",
        responsibility: "EHS Manager",
        site: "Factory A",
        department: "Production",
        dueDate: "2026-12-31",
        status: "Compliant",
        lastComplianceDate: "2026-01-15",
        evidence: "Audit report",
        notes: "Minor observations",
        createdBy: "Admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-15T00:00:00.000Z",
    },
    {
        id: "OBS-2",
        title: "Fire Safety Act",
        legislation: "Fire Safety Act",
        requirement: "Fire risk assessment",
        frequency: "Biannual",
        responsibility: "Safety Officer",
        site: "Factory B",
        department: "Warehouse",
        dueDate: "2026-06-30",
        status: "Pending",
        createdBy: "Admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
];
const fallbackAudits = [
    {
        id: "AUD-1",
        title: "ISO 45001 Surveillance Audit",
        type: "External",
        status: "In Progress",
        site: "Factory A",
        department: "Production",
        leadAuditor: "John Smith",
        teamMembers: ["Jane Doe"],
        startDate: "2026-01-10",
        endDate: "2026-01-15",
        scope: "Clause 4-10",
        criteria: "ISO 45001",
        findings: [],
        createdBy: "Admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
];
const fallbackLegalUpdates = [
    {
        id: "LGL-1",
        title: "OSHA Updates",
        legislation: "OSHA",
        jurisdiction: "National",
        effectiveDate: "2026-02-01",
        summary: "Updated PPE requirements",
        impactAssessment: "Low impact",
        actionRequired: "Update signage",
        assignedTo: "EHS Manager",
        dueDate: "2026-02-15",
        status: "New",
        source: "OSHA.gov",
        createdBy: "Admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
];
function asObligation(row) {
    return {
        id: String(row.id),
        title: String(row.title),
        legislation: String(row.legislation),
        requirement: String(row.requirement),
        frequency: String(row.frequency),
        responsibility: String(row.responsibility),
        site: String(row.site),
        department: String(row.department),
        dueDate: row.due_date ? String(row.due_date) : undefined,
        status: String(row.status),
        lastComplianceDate: row.last_compliance_date
            ? String(row.last_compliance_date)
            : undefined,
        evidence: row.evidence ? String(row.evidence) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asAudit(row) {
    let teamMembers = [];
    if (Array.isArray(row.team_members)) {
        teamMembers = row.team_members.map((m) => String(m));
    }
    let findings = [];
    if (Array.isArray(row.findings)) {
        findings = row.findings;
    }
    return {
        id: String(row.id),
        title: String(row.title),
        type: String(row.type),
        status: String(row.status),
        site: String(row.site),
        department: String(row.department),
        leadAuditor: String(row.lead_auditor),
        teamMembers,
        startDate: String(row.start_date),
        endDate: String(row.end_date),
        scope: row.scope ? String(row.scope) : undefined,
        criteria: row.criteria ? String(row.criteria) : undefined,
        findings,
        reportUrl: row.report_url ? String(row.report_url) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asLegalUpdate(row) {
    return {
        id: String(row.id),
        title: String(row.title),
        legislation: String(row.legislation),
        jurisdiction: String(row.jurisdiction),
        effectiveDate: String(row.effective_date),
        summary: String(row.summary),
        impactAssessment: row.impact_assessment
            ? String(row.impact_assessment)
            : undefined,
        actionRequired: row.action_required
            ? String(row.action_required)
            : undefined,
        assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
        dueDate: row.due_date ? String(row.due_date) : undefined,
        status: String(row.status),
        source: row.source ? String(row.source) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class ComplianceRepository {
    pool;
    constructor(pool = pgPool) {
        this.pool = pool;
    }
    shouldUseFallback() {
        return !Boolean(process.env.DATABASE_URL || process.env.DB_HOST || process.env.POSTGRES_URL);
    }
    async withFallback(fallback, operation) {
        if (this.shouldUseFallback()) {
            return fallback();
        }
        try {
            return await Promise.race([
                operation(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("compliance-repository-timeout")), 1500);
                }),
            ]);
        }
        catch {
            return fallback();
        }
    }
    async findObligations(filters) {
        return this.withFallback(() => {
            let results = [...fallbackObligations];
            if (filters?.status) {
                results = results.filter((obligation) => obligation.status === filters.status);
            }
            return results;
        }, async () => {
            const where = [];
            const params = [];
            let idx = 1;
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null && value !== "") {
                        const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                        if (key === "site") {
                            where.push(`${pgKey} ILIKE $${idx}`);
                            params.push(`%${value}%`);
                        }
                        else {
                            where.push(`${pgKey} = $${idx}`);
                            params.push(value);
                        }
                        idx++;
                    }
                });
            }
            const sql = `SELECT * FROM compliance_obligations ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
            const result = await this.pool.query(sql, params);
            return result.rows.map((row) => asObligation(row));
        });
    }
    async findObligationById(id) {
        return this.withFallback(() => fallbackObligations.find((obligation) => obligation.id === id) ?? null, async () => {
            const result = await this.pool.query("SELECT * FROM compliance_obligations WHERE id = $1", [id]);
            return result.rows[0]
                ? asObligation(result.rows[0])
                : null;
        });
    }
    async createObligation(data) {
        return this.withFallback(() => {
            const created = {
                id: `OBS-${fallbackObligations.length + 1}`,
                title: data.title,
                legislation: data.legislation,
                requirement: data.requirement,
                frequency: data.frequency,
                responsibility: data.responsibility,
                site: data.site ?? "",
                department: data.department ?? "",
                dueDate: data.dueDate,
                status: (data.status ?? "Pending"),
                lastComplianceDate: data.lastComplianceDate,
                evidence: data.evidence,
                notes: data.notes,
                createdBy: data.createdBy,
                createdAt: now(),
                updatedAt: now(),
            };
            fallbackObligations.unshift(created);
            return created;
        }, async () => {
            const result = await this.pool.query(`INSERT INTO compliance_obligations (id, title, legislation, requirement, frequency, responsibility, site, department, due_date, status, last_compliance_date, evidence, notes, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`, [
                data.title,
                data.legislation,
                data.requirement,
                data.frequency,
                data.responsibility,
                data.site,
                data.department,
                data.dueDate ?? null,
                data.status ?? "Pending",
                data.lastComplianceDate ?? null,
                data.evidence ?? null,
                data.notes ?? null,
                data.createdBy,
                now(),
                now(),
            ]);
            return asObligation(result.rows[0]);
        });
    }
    async updateObligation(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            legislation: "legislation",
            requirement: "requirement",
            frequency: "frequency",
            responsibility: "responsibility",
            site: "site",
            department: "department",
            dueDate: "due_date",
            status: "status",
            lastComplianceDate: "last_compliance_date",
            evidence: "evidence",
            notes: "notes",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                fields.push(`${map[key]} = $${idx}`);
                params.push(value);
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findObligationById(id);
        return this.withFallback(() => {
            const existing = fallbackObligations.find((obligation) => obligation.id === id);
            if (!existing)
                return null;
            Object.assign(existing, data, { updatedAt: now() });
            return existing;
        }, async () => {
            fields.push(`updated_at = $${idx}`);
            params.push(now());
            params.push(id);
            const sql = `UPDATE compliance_obligations SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
            const result = await this.pool.query(sql, params);
            return result.rows[0]
                ? asObligation(result.rows[0])
                : null;
        });
    }
    async deleteObligation(id) {
        return this.withFallback(() => {
            const index = fallbackObligations.findIndex((obligation) => obligation.id === id);
            if (index === -1)
                return false;
            fallbackObligations.splice(index, 1);
            return true;
        }, async () => {
            const result = await this.pool.query("DELETE FROM compliance_obligations WHERE id = $1", [id]);
            return (result.rowCount ?? 0) > 0;
        });
    }
    async findAudits(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                    if (key === "site") {
                        where.push(`${pgKey} ILIKE $${idx}`);
                        params.push(`%${value}%`);
                    }
                    else {
                        where.push(`${pgKey} = $${idx}`);
                        params.push(value);
                    }
                    idx++;
                }
            });
        }
        return this.withFallback(() => {
            let results = [...fallbackAudits];
            if (filters?.status) {
                results = results.filter((audit) => audit.status === filters.status);
            }
            return results;
        }, async () => {
            const sql = `SELECT * FROM audits ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
            const result = await this.pool.query(sql, params);
            return result.rows.map((row) => asAudit(row));
        });
    }
    async findAuditById(id) {
        return this.withFallback(() => fallbackAudits.find((audit) => audit.id === id) ?? null, async () => {
            const result = await this.pool.query("SELECT * FROM audits WHERE id = $1", [
                id,
            ]);
            return result.rows[0]
                ? asAudit(result.rows[0])
                : null;
        });
    }
    async createAudit(data) {
        return this.withFallback(() => {
            const created = {
                id: `AUD-${fallbackAudits.length + 1}`,
                title: data.title,
                type: data.type,
                status: (data.status ?? "Planned"),
                site: data.site ?? "",
                department: data.department ?? "",
                leadAuditor: data.leadAuditor ?? "",
                teamMembers: data.teamMembers ?? [],
                startDate: data.startDate ?? "",
                endDate: data.endDate ?? "",
                scope: data.scope,
                criteria: data.criteria,
                findings: data.findings ?? [],
                reportUrl: data.reportUrl,
                createdBy: data.createdBy,
                createdAt: now(),
                updatedAt: now(),
            };
            fallbackAudits.unshift(created);
            return created;
        }, async () => {
            const result = await this.pool.query(`INSERT INTO audits (id, title, type, status, site, department, lead_auditor, team_members, start_date, end_date, scope, criteria, findings, report_url, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16)
           RETURNING *`, [
                data.title,
                data.type,
                data.status ?? "Planned",
                data.site,
                data.department,
                data.leadAuditor,
                JSON.stringify(data.teamMembers ?? []),
                data.startDate,
                data.endDate,
                data.scope ?? null,
                data.criteria ?? null,
                JSON.stringify(data.findings ?? []),
                data.reportUrl ?? null,
                data.createdBy,
                now(),
                now(),
            ]);
            return asAudit(result.rows[0]);
        });
    }
    async updateAudit(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            type: "type",
            status: "status",
            site: "site",
            department: "department",
            leadAuditor: "lead_auditor",
            teamMembers: "team_members",
            startDate: "start_date",
            endDate: "end_date",
            scope: "scope",
            criteria: "criteria",
            findings: "findings",
            reportUrl: "report_url",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                if (key === "teamMembers" || key === "findings") {
                    fields.push(`${map[key]} = $${idx}::jsonb`);
                    params.push(JSON.stringify(value));
                }
                else {
                    fields.push(`${map[key]} = $${idx}`);
                    params.push(value);
                }
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findAuditById(id);
        return this.withFallback(() => {
            const existing = fallbackAudits.find((audit) => audit.id === id);
            if (!existing)
                return null;
            Object.assign(existing, data, { updatedAt: now() });
            return existing;
        }, async () => {
            fields.push(`updated_at = $${idx}`);
            params.push(now());
            params.push(id);
            const sql = `UPDATE audits SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
            const result = await this.pool.query(sql, params);
            return result.rows[0]
                ? asAudit(result.rows[0])
                : null;
        });
    }
    async deleteAudit(id) {
        return this.withFallback(() => {
            const index = fallbackAudits.findIndex((audit) => audit.id === id);
            if (index === -1)
                return false;
            fallbackAudits.splice(index, 1);
            return true;
        }, async () => {
            const result = await this.pool.query("DELETE FROM audits WHERE id = $1", [
                id,
            ]);
            return (result.rowCount ?? 0) > 0;
        });
    }
    async findLegalUpdates(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                    where.push(`${pgKey} = $${idx}`);
                    params.push(value);
                    idx++;
                }
            });
        }
        return this.withFallback(() => {
            let results = [...fallbackLegalUpdates];
            if (filters?.status) {
                results = results.filter((update) => update.status === filters.status);
            }
            return results;
        }, async () => {
            const sql = `SELECT * FROM legal_updates ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
            const result = await this.pool.query(sql, params);
            return result.rows.map((row) => asLegalUpdate(row));
        });
    }
    async findLegalUpdateById(id) {
        return this.withFallback(() => fallbackLegalUpdates.find((update) => update.id === id) ?? null, async () => {
            const result = await this.pool.query("SELECT * FROM legal_updates WHERE id = $1", [id]);
            return result.rows[0]
                ? asLegalUpdate(result.rows[0])
                : null;
        });
    }
    async createLegalUpdate(data) {
        return this.withFallback(() => {
            const created = {
                id: `LGL-${fallbackLegalUpdates.length + 1}`,
                title: data.title,
                legislation: data.legislation,
                jurisdiction: data.jurisdiction,
                effectiveDate: data.effectiveDate,
                summary: data.summary,
                impactAssessment: data.impactAssessment,
                actionRequired: data.actionRequired,
                assignedTo: data.assignedTo,
                dueDate: data.dueDate,
                status: (data.status ?? "New"),
                source: data.source,
                createdBy: data.createdBy,
                createdAt: now(),
                updatedAt: now(),
            };
            fallbackLegalUpdates.unshift(created);
            return created;
        }, async () => {
            const result = await this.pool.query(`INSERT INTO legal_updates (id, title, legislation, jurisdiction, effective_date, summary, impact_assessment, action_required, assigned_to, due_date, status, source, created_by, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`, [
                data.title,
                data.legislation,
                data.jurisdiction,
                data.effectiveDate,
                data.summary,
                data.impactAssessment ?? null,
                data.actionRequired ?? null,
                data.assignedTo ?? null,
                data.dueDate ?? null,
                data.status ?? "New",
                data.source ?? null,
                data.createdBy,
                now(),
                now(),
            ]);
            return asLegalUpdate(result.rows[0]);
        });
    }
    async updateLegalUpdate(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            legislation: "legislation",
            jurisdiction: "jurisdiction",
            effectiveDate: "effective_date",
            summary: "summary",
            impactAssessment: "impact_assessment",
            actionRequired: "action_required",
            assignedTo: "assigned_to",
            dueDate: "due_date",
            status: "status",
            source: "source",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                fields.push(`${map[key]} = $${idx}`);
                params.push(value);
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findLegalUpdateById(id);
        return this.withFallback(() => {
            const existing = fallbackLegalUpdates.find((update) => update.id === id);
            if (!existing)
                return null;
            Object.assign(existing, data, { updatedAt: now() });
            return existing;
        }, async () => {
            fields.push(`updated_at = $${idx}`);
            params.push(now());
            params.push(id);
            const sql = `UPDATE legal_updates SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
            const result = await this.pool.query(sql, params);
            return result.rows[0]
                ? asLegalUpdate(result.rows[0])
                : null;
        });
    }
    async deleteLegalUpdate(id) {
        return this.withFallback(() => {
            const index = fallbackLegalUpdates.findIndex((update) => update.id === id);
            if (index === -1)
                return false;
            fallbackLegalUpdates.splice(index, 1);
            return true;
        }, async () => {
            const result = await this.pool.query("DELETE FROM legal_updates WHERE id = $1", [id]);
            return (result.rowCount ?? 0) > 0;
        });
    }
    async getDashboard() {
        return this.withFallback(() => {
            const total = fallbackObligations.length;
            const compliant = fallbackObligations.filter((o) => o.status === "Compliant").length;
            const nonCompliant = fallbackObligations.filter((o) => o.status === "Non-Compliant").length;
            const pending = fallbackObligations.filter((o) => o.status === "Pending").length;
            const openAudits = fallbackAudits.filter((a) => a.status === "In Progress").length;
            return { total, compliant, nonCompliant, pending, openAudits };
        }, async () => {
            const obligationsResult = await this.pool.query("SELECT status FROM compliance_obligations");
            const auditsResult = await this.pool.query("SELECT status FROM audits");
            const obligations = obligationsResult.rows;
            const audits = auditsResult.rows;
            const total = obligations.length;
            const compliant = obligations.filter((o) => o.status === "Compliant").length;
            const nonCompliant = obligations.filter((o) => o.status === "Non-Compliant").length;
            const pending = obligations.filter((o) => o.status === "Pending").length;
            const openAudits = audits.filter((a) => a.status === "In Progress").length;
            return { total, compliant, nonCompliant, pending, openAudits };
        });
    }
}
