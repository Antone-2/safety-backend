const now = () => new Date().toISOString();
function asRecord(row) {
    return {
        id: String(row.id),
        visitorNo: String(row.visitor_no),
        fullName: String(row.full_name),
        companyName: row.company_name ? String(row.company_name) : undefined,
        idNumber: row.id_number ? String(row.id_number) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        email: row.email ? String(row.email) : undefined,
        hostName: String(row.host_name),
        hostUserId: row.host_user_id ? String(row.host_user_id) : undefined,
        site: String(row.site),
        department: row.department ? String(row.department) : undefined,
        areaToVisit: String(row.area_to_visit),
        purpose: String(row.purpose),
        visitDate: String(row.visit_date),
        checkInAt: row.check_in_at ? String(row.check_in_at) : undefined,
        checkOutAt: row.check_out_at ? String(row.check_out_at) : undefined,
        accessStatus: String(row.access_status),
        inductionStatus: String(row.induction_status),
        inductionCompletedAt: row.induction_completed_at ? String(row.induction_completed_at) : undefined,
        inductionExpiryDate: row.induction_expiry_date ? String(row.induction_expiry_date) : undefined,
        badgeNo: row.badge_no ? String(row.badge_no) : undefined,
        vehicleRegNo: row.vehicle_reg_no ? String(row.vehicle_reg_no) : undefined,
        accessCardIssued: Boolean(row.access_card_issued),
        ppeIssued: row.ppe_issued ? String(row.ppe_issued) : undefined,
        restrictions: row.restrictions ? String(row.restrictions) : undefined,
        emergencyContactName: row.emergency_contact_name ? String(row.emergency_contact_name) : undefined,
        emergencyContactPhone: row.emergency_contact_phone ? String(row.emergency_contact_phone) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class VisitorsRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async findAll(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value === undefined || value === null || value === "")
                    return;
                const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                where.push(`${column} = $${idx}`);
                params.push(value);
                idx += 1;
            });
        }
        const result = await this.pool.query(`SELECT * FROM visitor_access_records ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY visit_date DESC, created_at DESC`, params);
        return result.rows.map((row) => asRecord(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM visitor_access_records WHERE id = $1", [id]);
        return result.rows[0] ? asRecord(result.rows[0]) : null;
    }
    async create(data) {
        const visitorNo = `VIS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const result = await this.pool.query(`INSERT INTO visitor_access_records (
        id, visitor_no, full_name, company_name, id_number, phone, email, host_name, host_user_id,
        site, department, area_to_visit, purpose, visit_date, check_in_at, check_out_at, access_status,
        induction_status, induction_completed_at, induction_expiry_date, badge_no, vehicle_reg_no,
        access_card_issued, ppe_issued, restrictions, emergency_contact_name, emergency_contact_phone,
        notes, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26,
        $27, $28, $29, $30
      ) RETURNING *`, [
            visitorNo,
            data.fullName,
            data.companyName ?? null,
            data.idNumber ?? null,
            data.phone ?? null,
            data.email ?? null,
            data.hostName,
            data.hostUserId ?? null,
            data.site,
            data.department ?? null,
            data.areaToVisit,
            data.purpose,
            data.visitDate,
            data.checkInAt ?? null,
            data.checkOutAt ?? null,
            data.accessStatus,
            data.inductionStatus,
            data.inductionCompletedAt ?? null,
            data.inductionExpiryDate ?? null,
            data.badgeNo ?? null,
            data.vehicleRegNo ?? null,
            data.accessCardIssued,
            data.ppeIssued ?? null,
            data.restrictions ?? null,
            data.emergencyContactName ?? null,
            data.emergencyContactPhone ?? null,
            data.notes ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asRecord(result.rows[0]);
    }
    async update(id, data) {
        const updates = [];
        const params = [];
        let idx = 1;
        const map = {
            fullName: "full_name",
            companyName: "company_name",
            idNumber: "id_number",
            phone: "phone",
            email: "email",
            hostName: "host_name",
            hostUserId: "host_user_id",
            site: "site",
            department: "department",
            areaToVisit: "area_to_visit",
            purpose: "purpose",
            visitDate: "visit_date",
            checkInAt: "check_in_at",
            checkOutAt: "check_out_at",
            accessStatus: "access_status",
            inductionStatus: "induction_status",
            inductionCompletedAt: "induction_completed_at",
            inductionExpiryDate: "induction_expiry_date",
            badgeNo: "badge_no",
            vehicleRegNo: "vehicle_reg_no",
            accessCardIssued: "access_card_issued",
            ppeIssued: "ppe_issued",
            restrictions: "restrictions",
            emergencyContactName: "emergency_contact_name",
            emergencyContactPhone: "emergency_contact_phone",
            notes: "notes",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value === undefined || !map[key])
                return;
            updates.push(`${map[key]} = $${idx}`);
            params.push(value);
            idx += 1;
        });
        if (!updates.length)
            return this.findById(id);
        updates.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const result = await this.pool.query(`UPDATE visitor_access_records SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`, params);
        return result.rows[0] ? asRecord(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM visitor_access_records WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async findOnSite() {
        const result = await this.pool.query(`SELECT * FROM visitor_access_records
       WHERE access_status = 'On Site'
       ORDER BY COALESCE(check_in_at, visit_date) DESC`);
        return result.rows.map((row) => asRecord(row));
    }
    async findOverdueCheckouts() {
        const result = await this.pool.query(`SELECT * FROM visitor_access_records
       WHERE access_status = 'On Site'
         AND visit_date < NOW()::date
       ORDER BY visit_date ASC, created_at ASC`);
        return result.rows.map((row) => asRecord(row));
    }
    async getStats() {
        const [statusResult, overdueResult] = await Promise.all([
            this.pool.query(`SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE access_status = 'Planned')::int AS planned,
           COUNT(*) FILTER (WHERE access_status = 'On Site')::int AS on_site,
           COUNT(*) FILTER (WHERE access_status = 'Checked Out')::int AS checked_out,
           COUNT(*) FILTER (WHERE induction_status = 'Pending')::int AS induction_pending,
           COUNT(*) FILTER (WHERE access_status = 'On Site')::int AS active_visitors
         FROM visitor_access_records`),
            this.pool.query(`SELECT COUNT(*)::int AS overdue
         FROM visitor_access_records
         WHERE access_status = 'On Site'
           AND visit_date < NOW()::date`),
        ]);
        return {
            total: Number(statusResult.rows[0]?.total ?? 0),
            planned: Number(statusResult.rows[0]?.planned ?? 0),
            onSite: Number(statusResult.rows[0]?.on_site ?? 0),
            checkedOut: Number(statusResult.rows[0]?.checked_out ?? 0),
            overdueCheckouts: Number(overdueResult.rows[0]?.overdue ?? 0),
            inductionPending: Number(statusResult.rows[0]?.induction_pending ?? 0),
            activeVisitors: Number(statusResult.rows[0]?.active_visitors ?? 0),
        };
    }
}
