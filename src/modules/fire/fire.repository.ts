import { Pool } from "pg";
import type { FireEquipment, FireInspection, CreateFireEquipmentInput, UpdateFireEquipmentInput, CreateFireInspectionInput, FireStats } from "./fire.types.js";

const now = () => new Date().toISOString();

function asFireEquipment(row: Record<string, unknown>): FireEquipment {
  return {
    id: String(row.id),
    type: String(row.type) as FireEquipment["type"],
    location: String(row.location),
    building: String(row.building),
    floor: row.floor ? String(row.floor) : undefined,
    room: row.room ? String(row.room) : undefined,
    assetTag: String(row.asset_tag),
    manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
    model: row.model ? String(row.model) : undefined,
    serialNumber: row.serial_number ? String(row.serial_number) : undefined,
    installationDate: row.installation_date ? String(row.installation_date) : undefined,
    lastInspectionDate: row.last_inspection_date ? String(row.last_inspection_date) : undefined,
    nextInspectionDate: row.next_inspection_date ? String(row.next_inspection_date) : undefined,
    inspectionFrequency: row.inspection_frequency ? String(row.inspection_frequency) : undefined,
    status: String(row.status) as FireEquipment["status"],
    notes: row.notes ? String(row.notes) : undefined,
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asFireInspection(row: Record<string, unknown>): FireInspection {
  return {
    id: String(row.id),
    equipmentId: String(row.equipment_id),
    inspector: String(row.inspector),
    inspectionDate: String(row.inspection_date),
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

export class FireRepository {
  constructor(private pool: Pool) {}

  async findEquipment(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "location" || key === "assetTag") {
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

    const sql = `SELECT * FROM fire_equipment ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asFireEquipment(row as unknown as Record<string, unknown>));
  }

  async findEquipmentById(id: string) {
    const result = await this.pool.query("SELECT * FROM fire_equipment WHERE id = $1", [id]);
    return result.rows[0] ? asFireEquipment(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async createEquipment(data: CreateFireEquipmentInput) {
    const result = await this.pool.query(
      `INSERT INTO fire_equipment (id, type, location, building, floor, room, asset_tag, manufacturer, model, serial_number, installation_date, last_inspection_date, next_inspection_date, inspection_frequency, status, notes, photo_url, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        data.type,
        data.location,
        data.building,
        data.floor ?? null,
        data.room ?? null,
        data.assetTag,
        data.manufacturer ?? null,
        data.model ?? null,
        data.serialNumber ?? null,
        data.installationDate ?? null,
        data.lastInspectionDate ?? null,
        data.nextInspectionDate ?? null,
        data.inspectionFrequency ?? null,
        data.status ?? "Operational",
        data.notes ?? null,
        data.photoUrl ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asFireEquipment(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateEquipment(id: string, data: UpdateFireEquipmentInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      location: "location",
      building: "building",
      floor: "floor",
      room: "room",
      assetTag: "asset_tag",
      manufacturer: "manufacturer",
      model: "model",
      serialNumber: "serial_number",
      installationDate: "installation_date",
      lastInspectionDate: "last_inspection_date",
      nextInspectionDate: "next_inspection_date",
      inspectionFrequency: "inspection_frequency",
      status: "status",
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

    if (fields.length === 0) return this.findEquipmentById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE fire_equipment SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asFireEquipment(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async deleteEquipment(id: string) {
    const result = await this.pool.query("DELETE FROM fire_equipment WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findInspections(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
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

    const sql = `SELECT * FROM fire_inspections ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asFireInspection(row as unknown as Record<string, unknown>));
  }

  async createInspection(data: CreateFireInspectionInput) {
    const result = await this.pool.query(
      `INSERT INTO fire_inspections (id, equipment_id, inspector, inspection_date, findings, defects, action_required, passed, next_inspection_due, photo_url, created_by, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.equipmentId,
        data.inspector,
        data.inspectionDate,
        data.findings ?? null,
        data.defects ?? null,
        data.actionRequired ?? null,
        data.passed,
        data.nextInspectionDue,
        data.photoUrl ?? null,
        data.createdBy,
        now(),
      ]
    );
    const inspection = asFireInspection(result.rows[0] as unknown as Record<string, unknown>);
    await this.pool.query(
      `UPDATE fire_equipment SET last_inspection_date = $1, next_inspection_date = $2, updated_at = $3 WHERE id = $4`,
      [data.inspectionDate, data.nextInspectionDue, now(), data.equipmentId],
    );
    return inspection;
  }

  async findOverdue() {
    const result = await this.pool.query("SELECT * FROM fire_equipment WHERE next_inspection_date < NOW() AND status != 'Retired'");
    return result.rows.map((row) => asFireEquipment(row as unknown as Record<string, unknown>));
  }

  async getStats(): Promise<FireStats> {
    const equipmentResult = await this.pool.query("SELECT status, COUNT(*) as count FROM fire_equipment GROUP BY status");
    const equipment = equipmentResult.rows;
    const totalEquipment = equipment.reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const operational = equipment.find((row) => row.status === "Operational")
      ? parseInt(equipment.find((row) => row.status === "Operational")!.count as unknown as string, 10)
      : 0;
    const defective = equipment.find((row) => row.status === "Defective")
      ? parseInt(equipment.find((row) => row.status === "Defective")!.count as unknown as string, 10)
      : 0;

    const overdueResult = await this.pool.query("SELECT COUNT(*) as count FROM fire_equipment WHERE next_inspection_date < NOW() AND status != 'Retired'");
    const overdueInspections = parseInt(overdueResult.rows[0]?.count ?? "0", 10);

    const inspectionsResult = await this.pool.query("SELECT COUNT(*) as count FROM fire_inspections");
    const totalInspections = parseInt(inspectionsResult.rows[0]?.count ?? "0", 10);

    return { totalEquipment, operational, defective, overdueInspections, totalInspections };
  }
}
