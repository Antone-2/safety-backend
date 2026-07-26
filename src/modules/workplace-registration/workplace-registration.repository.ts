import { Pool } from "pg";
import type {
  WorkplaceRegistration,
  CreateWorkplaceRegistrationInput,
  UpdateWorkplaceRegistrationInput,
  WorkplaceValidity,
} from "./workplace-registration.types.js";
import { DEFAULT_WORKPLACE_REGISTRATIONS } from "./workplace-registration.seed.js";

const now = () => new Date().toISOString();

function computeValidity(expiryDate: string | null | undefined): WorkplaceValidity {
  if (!expiryDate) return "UNKNOWN";
  try {
    const expiry = new Date(expiryDate);
    if (Number.isNaN(expiry.getTime())) return "UNKNOWN";
    return expiry >= new Date() ? "VALID" : "EXPIRED";
  } catch {
    return "UNKNOWN";
  }
}

function mapRow(row: Record<string, unknown>): WorkplaceRegistration {
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
  constructor(private pool: Pool) {}

  async seedDefaultsIfEmpty(): Promise<void> {
    const countResult = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM workplace_registrations",
    );
    const count = Number(countResult.rows[0]?.count ?? 0);
    if (count > 0) return;

    const insertedAt = now();
    for (const reg of DEFAULT_WORKPLACE_REGISTRATIONS) {
      await this.pool.query(
        `INSERT INTO workplace_registrations (
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
        )`,
        [
          reg.location,
          reg.certificateNo || null,
          reg.dateOfIssue || null,
          reg.expiryDate || null,
          insertedAt,
          insertedAt,
        ],
      );
    }
  }

  async findAll(): Promise<WorkplaceRegistration[]> {
    const result = await this.pool.query(`
      SELECT *
      FROM workplace_registrations
      ORDER BY location ASC
    `);
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async findById(id: string): Promise<WorkplaceRegistration | null> {
    const result = await this.pool.query(
      "SELECT * FROM workplace_registrations WHERE id = $1",
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(data: CreateWorkplaceRegistrationInput): Promise<WorkplaceRegistration> {
    const result = await this.pool.query(
      `INSERT INTO workplace_registrations (
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
      RETURNING *`,
      [
        data.location,
        data.certificateNo || null,
        data.dateOfIssue || null,
        data.expiryDate || null,
        now(),
        now(),
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, data: UpdateWorkplaceRegistrationInput): Promise<WorkplaceRegistration | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx}`);
      params.push(value);
      idx++;
    };

    if (data.location !== undefined) push("location", data.location);
    if (data.certificateNo !== undefined) push("certificate_no", data.certificateNo || null);
    if (data.dateOfIssue !== undefined) push("date_of_issue", data.dateOfIssue || null);
    if (data.expiryDate !== undefined) push("expiry_date", data.expiryDate || null);

    if (fields.length === 0) return this.findById(id);

    push("updated_at", now());
    params.push(id);
    const result = await this.pool.query(
      `UPDATE workplace_registrations
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      params,
    );
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM workplace_registrations WHERE id = $1",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<{
    total: number;
    valid: number;
    expired: number;
    unknown: number;
  }> {
    const all = await this.findAll();
    const valid = all.filter((r) => r.validity === "VALID").length;
    const expired = all.filter((r) => r.validity === "EXPIRED").length;
    const unknown = all.filter((r) => r.validity === "UNKNOWN").length;
    return { total: all.length, valid, expired, unknown };
  }
}

