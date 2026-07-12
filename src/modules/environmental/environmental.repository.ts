import { Pool } from "pg";
import type { WasteRecord, Emission, Chemical, Spill, CreateWasteInput, UpdateWasteInput, CreateEmissionInput, UpdateEmissionInput, CreateChemicalInput, UpdateChemicalInput, CreateSpillInput, UpdateSpillInput, EnvironmentalStats } from "./environmental.types.js";

const now = () => new Date().toISOString();

function asWaste(row: Record<string, unknown>): WasteRecord {
  return {
    id: String(row.id),
    type: String(row.type) as WasteRecord["type"],
    category: String(row.category),
    description: String(row.description),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    generatedDate: String(row.generated_date),
    storedLocation: String(row.stored_location),
    disposedDate: row.disposed_date ? String(row.disposed_date) : undefined,
    disposalMethod: row.disposal_method ? String(row.disposal_method) : undefined,
    disposalContractor: row.disposal_contractor ? String(row.disposal_contractor) : undefined,
    manifestNumber: row.manifest_number ? String(row.manifest_number) : undefined,
    status: String(row.status) as WasteRecord["status"],
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asEmission(row: Record<string, unknown>): Emission {
  return {
    id: String(row.id),
    type: String(row.type) as Emission["type"],
    parameter: String(row.parameter),
    location: String(row.location),
    value: Number(row.value),
    unit: String(row.unit),
    limit: row.limit ? Number(row.limit) : undefined,
    monitoredDate: String(row.monitored_date),
    monitoredBy: String(row.monitored_by),
    equipment: row.equipment ? String(row.equipment) : undefined,
    correctiveAction: row.corrective_action ? String(row.corrective_action) : undefined,
    status: String(row.status) as Emission["status"],
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asChemical(row: Record<string, unknown>): Chemical {
  return {
    id: String(row.id),
    name: String(row.name),
    casNumber: row.cas_number ? String(row.cas_number) : undefined,
    formula: row.formula ? String(row.formula) : undefined,
    quantity: Number(row.quantity),
    unit: String(row.unit),
    storageLocation: String(row.storage_location),
    hazardClass: row.hazard_class ? String(row.hazard_class) : undefined,
    sdsUrl: row.sds_url ? String(row.sds_url) : undefined,
    expiryDate: row.expiry_date ? String(row.expiry_date) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asSpill(row: Record<string, unknown>): Spill {
  return {
    id: String(row.id),
    chemical: String(row.chemical),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    location: String(row.location),
    date: String(row.date),
    time: String(row.time),
    severity: String(row.severity) as Spill["severity"],
    affectedArea: row.affected_area ? String(row.affected_area) : undefined,
    responseActions: row.response_actions ? String(row.response_actions) : undefined,
    cleanupCompleted: Boolean(row.cleanup_completed),
    cleanupDate: row.cleanup_date ? String(row.cleanup_date) : undefined,
    reportedToNema: Boolean(row.reported_to_nema),
    nemaReportDate: row.nema_report_date ? String(row.nema_report_date) : undefined,
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class EnvironmentalRepository {
  constructor(private pool: Pool) {}

  async findWaste(filters?: Record<string, unknown>) {
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

    const sql = `SELECT * FROM waste_records ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asWaste(row as unknown as Record<string, unknown>));
  }

  async createWaste(data: CreateWasteInput) {
    const result = await this.pool.query(
      `INSERT INTO waste_records (id, type, category, description, quantity, unit, generated_date, stored_location, disposed_date, disposal_method, disposal_contractor, manifest_number, status, photo_url, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        data.type,
        data.category,
        data.description,
        data.quantity,
        data.unit,
        data.generatedDate,
        data.storedLocation,
        data.disposedDate ?? null,
        data.disposalMethod ?? null,
        data.disposalContractor ?? null,
        data.manifestNumber ?? null,
        data.status ?? "Stored",
        data.photoUrl ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asWaste(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateWaste(id: string, data: UpdateWasteInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      category: "category",
      description: "description",
      quantity: "quantity",
      unit: "unit",
      generatedDate: "generated_date",
      storedLocation: "stored_location",
      disposedDate: "disposed_date",
      disposalMethod: "disposal_method",
      disposalContractor: "disposal_contractor",
      manifestNumber: "manifest_number",
      status: "status",
      photoUrl: "photo_url",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      const result = await this.pool.query("SELECT * FROM waste_records WHERE id = $1", [id]);
      return result.rows[0] ? asWaste(result.rows[0] as unknown as Record<string, unknown>) : null;
    }

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE waste_records SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asWaste(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async findEmissions(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "location") {
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

    const sql = `SELECT * FROM emissions ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asEmission(row as unknown as Record<string, unknown>));
  }

  async createEmission(data: CreateEmissionInput) {
    const result = await this.pool.query(
      `INSERT INTO emissions (id, type, parameter, location, value, unit, limit, monitored_date, monitored_by, equipment, corrective_action, status, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.type,
        data.parameter,
        data.location,
        data.value,
        data.unit,
        data.limit ?? null,
        data.monitoredDate,
        data.monitoredBy,
        data.equipment ?? null,
        data.correctiveAction ?? null,
        data.status ?? "Within Limit",
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asEmission(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateEmission(id: string, data: UpdateEmissionInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      parameter: "parameter",
      location: "location",
      value: "value",
      unit: "unit",
      limit: "limit",
      monitoredDate: "monitored_date",
      monitoredBy: "monitored_by",
      equipment: "equipment",
      correctiveAction: "corrective_action",
      status: "status",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      const result = await this.pool.query("SELECT * FROM emissions WHERE id = $1", [id]);
      return result.rows[0] ? asEmission(result.rows[0] as unknown as Record<string, unknown>) : null;
    }

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE emissions SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asEmission(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async findChemicals(filters?: Record<string, unknown>) {
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

    const sql = `SELECT * FROM chemicals ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asChemical(row as unknown as Record<string, unknown>));
  }

  async createChemical(data: CreateChemicalInput) {
    const result = await this.pool.query(
      `INSERT INTO chemicals (id, name, cas_number, formula, quantity, unit, storage_location, hazard_class, sds_url, expiry_date, supplier, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.name,
        data.casNumber ?? null,
        data.formula ?? null,
        data.quantity,
        data.unit,
        data.storageLocation,
        data.hazardClass ?? null,
        data.sdsUrl ?? null,
        data.expiryDate ?? null,
        data.supplier ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asChemical(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateChemical(id: string, data: UpdateChemicalInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      name: "name",
      casNumber: "cas_number",
      formula: "formula",
      quantity: "quantity",
      unit: "unit",
      storageLocation: "storage_location",
      hazardClass: "hazard_class",
      sdsUrl: "sds_url",
      expiryDate: "expiry_date",
      supplier: "supplier",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      const result = await this.pool.query("SELECT * FROM chemicals WHERE id = $1", [id]);
      return result.rows[0] ? asChemical(result.rows[0] as unknown as Record<string, unknown>) : null;
    }

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE chemicals SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asChemical(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async findSpills(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "location") {
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

    const sql = `SELECT * FROM spills ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asSpill(row as unknown as Record<string, unknown>));
  }

  async createSpill(data: CreateSpillInput) {
    const result = await this.pool.query(
      `INSERT INTO spills (id, chemical, quantity, unit, location, date, time, severity, affected_area, response_actions, cleanup_completed, cleanup_date, reported_to_nema, nema_report_date, photo_url, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        data.chemical,
        data.quantity,
        data.unit,
        data.location,
        data.date,
        data.time,
        data.severity,
        data.affectedArea ?? null,
        data.responseActions ?? null,
        data.cleanupCompleted ?? false,
        data.cleanupDate ?? null,
        data.reportedToNema ?? false,
        data.nemaReportDate ?? null,
        data.photoUrl ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asSpill(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateSpill(id: string, data: UpdateSpillInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      chemical: "chemical",
      quantity: "quantity",
      unit: "unit",
      location: "location",
      date: "date",
      time: "time",
      severity: "severity",
      affectedArea: "affected_area",
      responseActions: "response_actions",
      cleanupCompleted: "cleanup_completed",
      cleanupDate: "cleanup_date",
      reportedToNema: "reported_to_nema",
      nemaReportDate: "nema_report_date",
      photoUrl: "photo_url",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      const result = await this.pool.query("SELECT * FROM spills WHERE id = $1", [id]);
      return result.rows[0] ? asSpill(result.rows[0] as unknown as Record<string, unknown>) : null;
    }

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE spills SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asSpill(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async getStats(): Promise<EnvironmentalStats> {
    const wasteResult = await this.pool.query("SELECT type, COUNT(*) as count FROM waste_records GROUP BY type");
    const waste = wasteResult.rows;
    const totalWaste = waste.reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const hazardousWaste = waste.find((row) => row.type === "Hazardous")
      ? parseInt(waste.find((row) => row.type === "Hazardous")!.count as unknown as string, 10)
      : 0;

    const emissionsResult = await this.pool.query("SELECT status, COUNT(*) as count FROM emissions GROUP BY status");
    const emissions = emissionsResult.rows;
    const totalEmissions = emissions.reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const exceedances = emissions.filter((row) => row.status !== "Within Limit")
      .reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);

    const chemicalsResult = await this.pool.query("SELECT COUNT(*) as count FROM chemicals");
    const totalChemicals = parseInt(chemicalsResult.rows[0]?.count ?? "0", 10);

    const spillsResult = await this.pool.query("SELECT severity, COUNT(*) as count FROM spills GROUP BY severity");
    const spills = spillsResult.rows;
    const totalSpills = spills.reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const majorSpills = spills.filter((row) => row.severity === "Major" || row.severity === "Critical")
      .reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);

    return {
      totalWaste,
      hazardousWaste,
      totalEmissions,
      exceedances,
      totalChemicals,
      totalSpills,
      majorSpills,
    };
  }
}
