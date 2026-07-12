import { Pool } from "pg";
import type { Scaffold, CreateScaffoldInput, UpdateScaffoldInput, ScaffoldStats } from "./scaffolding.types.js";

const now = () => new Date().toISOString();

function asScaffold(row: Record<string, unknown>): Scaffold {
  return {
    id: String(row.id),
    scaffoldNo: row.scaffold_no ? String(row.scaffold_no) : undefined,
    location: String(row.location),
    building: String(row.building),
    floor: row.floor ? String(row.floor) : undefined,
    room: row.room ? String(row.room) : undefined,
    type: String(row.type),
    height: Number(row.height),
    length: row.length != null ? Number(row.length) : undefined,
    width: row.width != null ? Number(row.width) : undefined,
    erectedBy: String(row.erected_by),
    erectedDate: row.erected_date ? String(row.erected_date) : undefined,
    inspectedBy: row.inspected_by ? String(row.inspected_by) : undefined,
    inspectedDate: row.inspected_date ? String(row.inspected_date) : undefined,
    nextInspectionDate: row.next_inspection_date ? String(row.next_inspection_date) : undefined,
    status: String(row.status) as Scaffold["status"],
    tagNumber: row.tag_number ? String(row.tag_number) : undefined,
    photos: Array.isArray(row.photos) ? row.photos.map((p: unknown) => String(p)) : [],
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ScaffoldRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "location" || key === "building" || key === "type") {
            where.push(`${pgKey} ILIKE $${idx}`);
            params.push(`%${value}%`);
          } else {
            where.push(`${pgKey} = $${idx}`);
            params.push(value);
          }
          idx++;
        }
      });
    }

    const sql = `SELECT * FROM scaffolding ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asScaffold(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM scaffolding WHERE id = $1", [id]);
    return result.rows[0] ? asScaffold(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreateScaffoldInput) {
    const scaffoldNo = `SCAF-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const result = await this.pool.query(
      `INSERT INTO scaffolding (id, scaffold_no, location, building, floor, room, type, height, length, width, erected_by, erected_date, inspected_by, inspected_date, next_inspection_date, status, tag_number, photos, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21)
       RETURNING *`,
      [
        scaffoldNo,
        data.location,
        data.building,
        data.floor ?? null,
        data.room ?? null,
        data.type,
        data.height,
        data.length ?? null,
        data.width ?? null,
        data.erectedBy,
        data.erectedDate ?? null,
        data.inspectedBy ?? null,
        data.inspectedDate ?? null,
        data.nextInspectionDate ?? null,
        data.status ?? "Erected",
        data.tagNumber ?? null,
        JSON.stringify(data.photos ?? []),
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asScaffold(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateScaffoldInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      location: "location",
      building: "building",
      floor: "floor",
      room: "room",
      type: "type",
      height: "height",
      length: "length",
      width: "width",
      erectedBy: "erected_by",
      erectedDate: "erected_date",
      inspectedBy: "inspected_by",
      inspectedDate: "inspected_date",
      nextInspectionDate: "next_inspection_date",
      status: "status",
      tagNumber: "tag_number",
      photos: "photos",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "photos") {
          fields.push(`${map[key]} = $${idx}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${map[key]} = $${idx}`);
          params.push(value);
        }
        idx++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE scaffolding SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asScaffold(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM scaffolding WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<ScaffoldStats> {
    const result = await this.pool.query("SELECT status, COUNT(*) as count FROM scaffolding GROUP BY status");
    const stats: Record<string, number> = {};
    result.rows.forEach((row) => {
      stats[String(row.status)] = parseInt(row.count as unknown as string, 10);
    });

    const needsInspectionResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM scaffolding WHERE next_inspection_date IS NOT NULL AND next_inspection_date <= NOW()"
    );
    const needsInspection = parseInt(needsInspectionResult.rows[0]?.count ?? "0", 10);

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      inUse: stats["In Use"] || 0,
      needsInspection,
      taggedOut: stats["Tagged Out"] || 0,
    };
  }
}
