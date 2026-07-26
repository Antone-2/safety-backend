import { DEFAULT_WORKPLACE_REGISTRATIONS } from "./workplace-registration.seed.js";
const now = () => new Date().toISOString();
function computeValidity(expiryDate) {
    if (!expiryDate)
        return "UNKNOWN";
    try {
        const expiry = new Date(expiryDate);
        if (Number.isNaN(expiry.getTime()))
            return "UNKNOWN";
        return expiry >= new Date() ? "VALID" : "EXPIRED";
    }
    catch {
        return "UNKNOWN";
    }
}
function mapRow(row) {
    const expiryDate = row.expiry_date ? String(row.expiry_date) : "";
    return {
        id: String(row.id),
        location: String(row.location),
        certificateNo: row.certificate_no ? String(row.certificate_no) : "",
        dateOfIssue: row.date_of_issue ? String(row.date_of_issue) : "",
        expiryDate,
        validity: computeValidity(expiryDate),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class WorkplaceRegistrationRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async seedDefaultsIfEmpty() {
        const countResult = await this.pool.query("SELECT COUNT(*)::int AS count FROM workplace_registrations");
        const count = Number(countResult.rows[0]?.count ?? 0);
        if (count > 0)
            return;
        const insertedAt = now();
        for (const reg of DEFAULT_WORKPLACE_REGISTRATIONS) {
            await this.pool.query(`INSERT INTO workplace_registrations (
          id,
          location,
          certificate_no,
          date_of_issue,
          expiry_date,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3::date,
          $4::date,
          $5,
          $6
        )`, [
                reg.location,
                reg.certificateNo || null,
                reg.dateOfIssue || null,
                reg.expiryDate || null,
                insertedAt,
                insertedAt,
            ]);
        }
    }
    async findAll() {
        const result = await this.pool.query(`
      SELECT *
      FROM workplace_registrations
      ORDER BY location ASC
    `);
        return result.rows.map((row) => mapRow(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM workplace_registrations WHERE id = $1", [id]);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async create(data) {
        const result = await this.pool.query(`INSERT INTO workplace_registrations (
        id,
        location,
        certificate_no,
        date_of_issue,
        expiry_date,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3::date,
        $4::date,
        $5,
        $6
      )
      RETURNING *`, [
            data.location,
            data.certificateNo || null,
            data.dateOfIssue || null,
            data.expiryDate || null,
            now(),
            now(),
        ]);
        return mapRow(result.rows[0]);
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const push = (column, value) => {
            fields.push(`${column} = $${idx}`);
            params.push(value);
            idx++;
        };
        if (data.location !== undefined)
            push("location", data.location);
        if (data.certificateNo !== undefined)
            push("certificate_no", data.certificateNo || null);
        if (data.dateOfIssue !== undefined)
            push("date_of_issue", data.dateOfIssue || null);
        if (data.expiryDate !== undefined)
            push("expiry_date", data.expiryDate || null);
        if (fields.length === 0)
            return this.findById(id);
        push("updated_at", now());
        params.push(id);
        const result = await this.pool.query(`UPDATE workplace_registrations
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`, params);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM workplace_registrations WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async getStats() {
        const all = await this.findAll();
        const valid = all.filter((r) => r.validity === "VALID").length;
        const expired = all.filter((r) => r.validity === "EXPIRED").length;
        const unknown = all.filter((r) => r.validity === "UNKNOWN").length;
        return { total: all.length, valid, expired, unknown };
    }
}
