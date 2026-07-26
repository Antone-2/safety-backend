import { Pool } from "pg";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import type {
  StatutoryAuditRecord,
  AuditLocationCategory,
  AuditTypeEnum,
} from "./statutory-audits.types.js";
import { ALL_AUDIT_TYPES } from "./statutory-audits.types.js";

const now = () => new Date().toISOString();

function mapRow(row: Record<string, unknown>): StatutoryAuditRecord {
  return {
    id: String(row.id),
    locationCategory: String(row.location_category) as AuditLocationCategory,
    locationName: String(row.location_name),
    sortOrder: Number(row.sort_order),
    auditType: String(row.audit_type) as AuditTypeEnum,
    dateDone: row.date_done ? String(row.date_done) : undefined,
    remarks: row.remarks ? String(row.remarks) : undefined,
    referenceNo: row.reference_no ? String(row.reference_no) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class StatutoryAuditRepository {
  constructor(private pool: Pool = pgPool) {}

  async findAll(filters?: {
    locationCategory?: string;
    locationName?: string;
  }): Promise<StatutoryAuditRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.locationCategory) {
      where.push(`location_category = $${idx}`);
      params.push(filters.locationCategory);
      idx++;
    }
    if (filters?.locationName) {
      where.push(`location_name ILIKE $${idx}`);
      params.push(`%${filters.locationName}%`);
      idx++;
    }

    const sql = `SELECT * FROM statutory_audit_records ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY sort_order ASC, location_name ASC, audit_type ASC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => mapRow(row as unknown as Record<string, unknown>));
  }

  async getMatrix(filters?: { locationCategory?: string; search?: string }): Promise<{
    locations: Array<{
      locationCategory: AuditLocationCategory;
      locationName: string;
      sortOrder: number;
      audits: Record<string, { dateDone?: string; remarks?: string; referenceNo?: string }>;
    }>;
    auditTypes: AuditTypeEnum[];
  }> {
    const records = await this.findAll(
      filters?.locationCategory || filters?.search
        ? { locationCategory: filters.locationCategory, locationName: filters.search }
        : undefined,
    );

    // Build unique sorted locations
    const locationMap = new Map<string, {
      locationCategory: AuditLocationCategory;
      locationName: string;
      sortOrder: number;
      audits: Record<string, { dateDone?: string; remarks?: string; referenceNo?: string }>;
    }>();

    for (const record of records) {
      const key = `${record.locationCategory}::${record.locationName}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          locationCategory: record.locationCategory,
          locationName: record.locationName,
          sortOrder: record.sortOrder,
          audits: {},
        });
      }
      const loc = locationMap.get(key)!;
      loc.audits[record.auditType] = {
        dateDone: record.dateDone,
        remarks: record.remarks,
        referenceNo: record.referenceNo,
      };
    }

    // If no records found at all, return empty
    const locations = Array.from(locationMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.locationName.localeCompare(b.locationName),
    );

    return {
      locations,
      auditTypes: ALL_AUDIT_TYPES,
    };
  }

  async upsertRecord(
    locationCategory: string,
    locationName: string,
    sortOrder: number,
    auditType: string,
    data: { dateDone?: string; remarks?: string; referenceNo?: string },
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO statutory_audit_records (id, location_category, location_name, sort_order, audit_type, date_done, remarks, reference_no, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (location_category, location_name, audit_type) DO UPDATE SET
         sort_order = EXCLUDED.sort_order,
         date_done = EXCLUDED.date_done,
         remarks = EXCLUDED.remarks,
         reference_no = EXCLUDED.reference_no,
         updated_at = $9`,
      [
        locationCategory,
        locationName,
        sortOrder,
        auditType,
        data.dateDone ?? null,
        data.remarks ?? null,
        data.referenceNo ?? null,
        now(),
        now(),
      ],
    );
  }

  async existsByLocation(locationCategory: string, locationName: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM statutory_audit_records
       WHERE location_category = $1 AND location_name = $2
       LIMIT 1`,
      [locationCategory, locationName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByLocation(locationCategory: string, locationName: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM statutory_audit_records WHERE location_category = $1 AND location_name = $2",
      [locationCategory, locationName],
    );
  }

  async getSummary(): Promise<{
    totalLocations: number;
    validCount: number;
    expiredCount: number;
    wipCount: number;
    plannedCount: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(DISTINCT location_category || '::' || location_name) as total_locations,
        COUNT(*) FILTER (WHERE UPPER(remarks) = 'VALID') as valid_count,
        COUNT(*) FILTER (WHERE UPPER(remarks) = 'EXPIRED') as expired_count,
        COUNT(*) FILTER (WHERE UPPER(remarks) = 'WIP') as wip_count,
        COUNT(*) FILTER (WHERE UPPER(remarks) = 'PLANNED') as planned_count
      FROM statutory_audit_records
    `);

    const row = result.rows[0] as Record<string, unknown>;
    return {
      totalLocations: Number(row.total_locations),
      validCount: Number(row.valid_count),
      expiredCount: Number(row.expired_count),
      wipCount: Number(row.wip_count),
      plannedCount: Number(row.planned_count),
    };
  }
}

