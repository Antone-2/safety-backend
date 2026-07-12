const now = () => new Date().toISOString();
function asEquipment(row) {
    return {
        id: String(row.id),
        name: String(row.name),
        type: String(row.type),
        category: String(row.category),
        assetTag: String(row.asset_tag),
        serialNumber: row.serial_number ? String(row.serial_number) : undefined,
        manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
        model: row.model ? String(row.model) : undefined,
        location: String(row.location),
        site: String(row.site),
        department: String(row.department),
        purchaseDate: row.purchase_date ? String(row.purchase_date) : undefined,
        installationDate: row.installation_date ? String(row.installation_date) : undefined,
        warrantyExpiry: row.warranty_expiry ? String(row.warranty_expiry) : undefined,
        lastInspectionDate: row.last_inspection_date ? String(row.last_inspection_date) : undefined,
        nextInspectionDate: row.next_inspection_date ? String(row.next_inspection_date) : undefined,
        inspectionFrequency: row.inspection_frequency ? String(row.inspection_frequency) : undefined,
        status: String(row.status),
        condition: row.condition ? String(row.condition) : undefined,
        assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        photoUrl: row.photo_url ? String(row.photo_url) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asInspection(row) {
    return {
        id: String(row.id),
        equipmentId: String(row.equipment_id),
        inspector: String(row.inspector),
        inspectionDate: String(row.inspection_date),
        inspectionType: String(row.inspection_type),
        findings: row.findings ? String(row.findings) : undefined,
        defects: row.defects ? String(row.defects) : undefined,
        actionRequired: row.action_required ? String(row.action_required) : undefined,
        passed: Boolean(row.passed),
        nextInspectionDue: String(row.next_inspection_due),
        photoUrl: row.photo_url ? String(row.photo_url) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
    };
}
export class EquipmentRepository {
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
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
                    if (key === "location" || key === "name" || key === "assetTag") {
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
        const sql = `SELECT * FROM equipment ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asEquipment(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM equipment WHERE id = $1", [id]);
        return result.rows[0] ? asEquipment(result.rows[0]) : null;
    }
    async create(data) {
        const result = await this.pool.query(`INSERT INTO equipment (id, name, type, category, asset_tag, serial_number, manufacturer, model, location, site, department, purchase_date, installation_date, warranty_expiry, last_inspection_date, next_inspection_date, inspection_frequency, status, "condition", assigned_to, notes, photo_url, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       RETURNING *`, [
            data.name,
            data.type,
            data.category,
            data.assetTag,
            data.serialNumber ?? null,
            data.manufacturer ?? null,
            data.model ?? null,
            data.location,
            data.site,
            data.department,
            data.purchaseDate ?? null,
            data.installationDate ?? null,
            data.warrantyExpiry ?? null,
            data.lastInspectionDate ?? null,
            data.nextInspectionDate ?? null,
            data.inspectionFrequency ?? null,
            data.status ?? "Operational",
            data.condition ?? null,
            data.assignedTo ?? null,
            data.notes ?? null,
            data.photoUrl ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asEquipment(result.rows[0]);
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            name: "name",
            type: "type",
            category: "category",
            assetTag: "asset_tag",
            serialNumber: "serial_number",
            manufacturer: "manufacturer",
            model: "model",
            location: "location",
            site: "site",
            department: "department",
            purchaseDate: "purchase_date",
            installationDate: "installation_date",
            warrantyExpiry: "warranty_expiry",
            lastInspectionDate: "last_inspection_date",
            nextInspectionDate: "next_inspection_date",
            inspectionFrequency: "inspection_frequency",
            status: "status",
            condition: "condition",
            assignedTo: "assigned_to",
            notes: "notes",
            photoUrl: "photo_url",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                fields.push(`${map[key]} = $${idx}`);
                params.push(value);
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findById(id);
        fields.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const sql = `UPDATE equipment SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
        const result = await this.pool.query(sql, params);
        return result.rows[0] ? asEquipment(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM equipment WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async findInspections(filters) {
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
        const sql = `SELECT * FROM equipment_inspections ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map((row) => asInspection(row));
    }
    async createInspection(data) {
        const result = await this.pool.query(`INSERT INTO equipment_inspections (id, equipment_id, inspector, inspection_date, inspection_type, findings, defects, action_required, passed, next_inspection_due, photo_url, created_by, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`, [
            data.equipmentId,
            data.inspector,
            data.inspectionDate,
            data.inspectionType,
            data.findings ?? null,
            data.defects ?? null,
            data.actionRequired ?? null,
            data.passed,
            data.nextInspectionDue,
            data.photoUrl ?? null,
            data.createdBy,
            now(),
        ]);
        const inspection = asInspection(result.rows[0]);
        await this.pool.query(`UPDATE equipment SET last_inspection_date = $1, next_inspection_date = $2, updated_at = $3 WHERE id = $4`, [data.inspectionDate, data.nextInspectionDue, now(), data.equipmentId]);
        return inspection;
    }
    async getStats() {
        const result = await this.pool.query("SELECT status, COUNT(*) as count FROM equipment GROUP BY status");
        const stats = {};
        result.rows.forEach((row) => {
            stats[String(row.status)] = parseInt(row.count, 10);
        });
        return {
            total: Object.values(stats).reduce((sum, count) => sum + count, 0),
            operational: stats["Operational"] || 0,
            maintenance: stats["Under Maintenance"] || 0,
            retired: stats["Retired"] || 0,
        };
    }
    async count(filters) {
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
        const sql = `SELECT COUNT(*) as count FROM equipment ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}`;
        const result = await this.pool.query(sql, params);
        return parseInt(result.rows[0]?.count ?? "0", 10);
    }
}
