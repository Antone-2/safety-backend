import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";

export const EsgCategorySchema = z.enum(["Environmental", "Social", "Governance"]);
export type EsgCategory = z.infer<typeof EsgCategorySchema>;

export const CarbonEmissionSchema = z.object({
  id: z.string().optional(),
  category: EsgCategorySchema,
  scope: z.enum(["Scope 1", "Scope 2", "Scope 3"]),
  source: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  co2Equivalent: z.number().min(0),
  period: z.string().min(1).max(50),
  recordedDate: z.string().min(1),
  site: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});

export const EnergyRecordSchema = z.object({
  id: z.string().optional(),
  source: z.enum(["Electricity", "Diesel", "Petrol", "Natural Gas", "Solar", "Other"]),
  consumption: z.number().min(0),
  unit: z.string().min(1).max(20),
  cost: z.number().min(0).optional(),
  period: z.string().min(1).max(50),
  recordedDate: z.string().min(1),
  site: z.string().min(1).max(200),
  meterReading: z.number().optional(),
  notes: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});

export const WaterRecordSchema = z.object({
  id: z.string().optional(),
  source: z.enum(["Municipal", "Borehole", "Rainwater", "Other"]),
  consumption: z.number().min(0),
  unit: z.string().min(1).max(20),
  cost: z.number().min(0).optional(),
  period: z.string().min(1).max(50),
  recordedDate: z.string().min(1),
  site: z.string().min(1).max(200),
  recycled: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});

type CarbonEmission = z.infer<typeof CarbonEmissionSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type EnergyRecord = z.infer<typeof EnergyRecordSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type WaterRecord = z.infer<typeof WaterRecordSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();

function mapCarbonRow(row: Record<string, unknown>): CarbonEmission {
  return {
    id: String(row.id),
    category: String(row.category ?? "Environmental") as EsgCategory,
    scope: String(row.scope ?? "Scope 1") as z.infer<typeof CarbonEmissionSchema.shape.scope>,
    source: String(row.source ?? ""),
    description: row.description ? String(row.description) : undefined,
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? ""),
    co2Equivalent: Number(row.co2_equivalent ?? 0),
    period: String(row.period ?? ""),
    recordedDate: row.recorded_date ? new Date(String(row.recorded_date)).toISOString() : "",
    site: String(row.site ?? ""),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by ?? "System"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
  };
}

function mapEnergyRow(row: Record<string, unknown>): EnergyRecord {
  return {
    id: String(row.id),
    source: String(row.source ?? "Other") as z.infer<typeof EnergyRecordSchema.shape.source>,
    consumption: Number(row.consumption ?? 0),
    unit: String(row.unit ?? ""),
    cost: row.cost == null ? undefined : Number(row.cost),
    period: String(row.period ?? ""),
    recordedDate: row.recorded_date ? new Date(String(row.recorded_date)).toISOString() : "",
    site: String(row.site ?? ""),
    meterReading: row.meter_reading == null ? undefined : Number(row.meter_reading),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by ?? "System"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
  };
}

function mapWaterRow(row: Record<string, unknown>): WaterRecord {
  return {
    id: String(row.id),
    source: String(row.source ?? "Other") as z.infer<typeof WaterRecordSchema.shape.source>,
    consumption: Number(row.consumption ?? 0),
    unit: String(row.unit ?? ""),
    cost: row.cost == null ? undefined : Number(row.cost),
    period: String(row.period ?? ""),
    recordedDate: row.recorded_date ? new Date(String(row.recorded_date)).toISOString() : "",
    site: String(row.site ?? ""),
    recycled: row.recycled == null ? undefined : Number(row.recycled),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by ?? "System"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
  };
}

export class EsgService {
  async createCarbonEmission(data: z.infer<typeof CarbonEmissionSchema>) {
    const validated = CarbonEmissionSchema.parse(data);
    const id = validated.id || uuidv4();
    const timestamp = now();
    const result = await pgPool.query(
      `INSERT INTO carbon_emissions (
        id, category, scope, source, description, quantity, unit, co2_equivalent,
        period, recorded_date, site, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *`,
      [
        id,
        validated.category,
        validated.scope,
        validated.source,
        validated.description ?? null,
        validated.quantity,
        validated.unit,
        validated.co2Equivalent,
        validated.period,
        validated.recordedDate,
        validated.site,
        validated.notes ?? null,
        validated.createdBy,
        timestamp,
        timestamp,
      ],
    );
    return mapCarbonRow(result.rows[0] as Record<string, unknown>);
  }

  async getCarbonEmissions(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    const columns: Record<string, string> = { scope: "scope", period: "period", site: "site" };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      const column = columns[key];
      if (!column || value === undefined || value === null || value === "") return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    });
    const sql = `SELECT * FROM carbon_emissions${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const result = await pgPool.query(sql, params);
    return result.rows.map((row) => mapCarbonRow(row as Record<string, unknown>));
  }

  async updateCarbonEmission(id: string, data: Partial<z.infer<typeof CarbonEmissionSchema>>) {
    const map: Record<string, string> = {
      category: "category",
      scope: "scope",
      source: "source",
      description: "description",
      quantity: "quantity",
      unit: "unit",
      co2Equivalent: "co2_equivalent",
      period: "period",
      recordedDate: "recorded_date",
      site: "site",
      notes: "notes",
      createdBy: "created_by",
    };
    const fields: string[] = [];
    const params: unknown[] = [];
    Object.entries(data).forEach(([key, value]) => {
      const column = map[key];
      if (!column || value === undefined) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    });
    if (fields.length === 0) {
      const result = await pgPool.query("SELECT * FROM carbon_emissions WHERE id = $1", [id]);
      return result.rows[0] ? mapCarbonRow(result.rows[0] as Record<string, unknown>) : null;
    }
    params.push(now());
    fields.push(`updated_at = $${params.length}`);
    params.push(id);
    const result = await pgPool.query(
      `UPDATE carbon_emissions SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? mapCarbonRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteCarbonEmission(id: string) {
    const result = await pgPool.query("DELETE FROM carbon_emissions WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createEnergyRecord(data: z.infer<typeof EnergyRecordSchema>) {
    const validated = EnergyRecordSchema.parse(data);
    const id = validated.id || uuidv4();
    const timestamp = now();
    const result = await pgPool.query(
      `INSERT INTO energy_records (
        id, source, consumption, unit, cost, period, recorded_date, site,
        meter_reading, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        id,
        validated.source,
        validated.consumption,
        validated.unit,
        validated.cost ?? null,
        validated.period,
        validated.recordedDate,
        validated.site,
        validated.meterReading ?? null,
        validated.notes ?? null,
        validated.createdBy,
        timestamp,
        timestamp,
      ],
    );
    return mapEnergyRow(result.rows[0] as Record<string, unknown>);
  }

  async getEnergyRecords(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    const columns: Record<string, string> = { source: "source", period: "period", site: "site" };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      const column = columns[key];
      if (!column || value === undefined || value === null || value === "") return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    });
    const sql = `SELECT * FROM energy_records${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const result = await pgPool.query(sql, params);
    return result.rows.map((row) => mapEnergyRow(row as Record<string, unknown>));
  }

  async updateEnergyRecord(id: string, data: Partial<z.infer<typeof EnergyRecordSchema>>) {
    const map: Record<string, string> = {
      source: "source",
      consumption: "consumption",
      unit: "unit",
      cost: "cost",
      period: "period",
      recordedDate: "recorded_date",
      site: "site",
      meterReading: "meter_reading",
      notes: "notes",
      createdBy: "created_by",
    };
    const fields: string[] = [];
    const params: unknown[] = [];
    Object.entries(data).forEach(([key, value]) => {
      const column = map[key];
      if (!column || value === undefined) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    });
    if (fields.length === 0) {
      const result = await pgPool.query("SELECT * FROM energy_records WHERE id = $1", [id]);
      return result.rows[0] ? mapEnergyRow(result.rows[0] as Record<string, unknown>) : null;
    }
    params.push(now());
    fields.push(`updated_at = $${params.length}`);
    params.push(id);
    const result = await pgPool.query(
      `UPDATE energy_records SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? mapEnergyRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteEnergyRecord(id: string) {
    const result = await pgPool.query("DELETE FROM energy_records WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createWaterRecord(data: z.infer<typeof WaterRecordSchema>) {
    const validated = WaterRecordSchema.parse(data);
    const id = validated.id || uuidv4();
    const timestamp = now();
    const result = await pgPool.query(
      `INSERT INTO water_records (
        id, source, consumption, unit, cost, period, recorded_date, site,
        recycled, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        id,
        validated.source,
        validated.consumption,
        validated.unit,
        validated.cost ?? null,
        validated.period,
        validated.recordedDate,
        validated.site,
        validated.recycled ?? null,
        validated.notes ?? null,
        validated.createdBy,
        timestamp,
        timestamp,
      ],
    );
    return mapWaterRow(result.rows[0] as Record<string, unknown>);
  }

  async getWaterRecords(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    const columns: Record<string, string> = { period: "period", site: "site" };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      const column = columns[key];
      if (!column || value === undefined || value === null || value === "") return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    });
    const sql = `SELECT * FROM water_records${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const result = await pgPool.query(sql, params);
    return result.rows.map((row) => mapWaterRow(row as Record<string, unknown>));
  }

  async updateWaterRecord(id: string, data: Partial<z.infer<typeof WaterRecordSchema>>) {
    const map: Record<string, string> = {
      source: "source",
      consumption: "consumption",
      unit: "unit",
      cost: "cost",
      period: "period",
      recordedDate: "recorded_date",
      site: "site",
      recycled: "recycled",
      notes: "notes",
      createdBy: "created_by",
    };
    const fields: string[] = [];
    const params: unknown[] = [];
    Object.entries(data).forEach(([key, value]) => {
      const column = map[key];
      if (!column || value === undefined) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    });
    if (fields.length === 0) {
      const result = await pgPool.query("SELECT * FROM water_records WHERE id = $1", [id]);
      return result.rows[0] ? mapWaterRow(result.rows[0] as Record<string, unknown>) : null;
    }
    params.push(now());
    fields.push(`updated_at = $${params.length}`);
    params.push(id);
    const result = await pgPool.query(
      `UPDATE water_records SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? mapWaterRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteWaterRecord(id: string) {
    const result = await pgPool.query("DELETE FROM water_records WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getEsgDashboard() {
    const [carbonResult, energyResult, waterResult] = await Promise.all([
      pgPool.query("SELECT COALESCE(SUM(co2_equivalent), 0) AS total, COUNT(*) AS count FROM carbon_emissions"),
      pgPool.query("SELECT COALESCE(SUM(consumption), 0) AS total, COUNT(*) AS count FROM energy_records"),
      pgPool.query("SELECT COALESCE(SUM(consumption), 0) AS total, COUNT(*) AS count FROM water_records"),
    ]);

    return {
      totalCO2: Number(carbonResult.rows[0]?.total ?? 0),
      totalEnergy: Number(energyResult.rows[0]?.total ?? 0),
      totalWater: Number(waterResult.rows[0]?.total ?? 0),
      carbonRecords: Number(carbonResult.rows[0]?.count ?? 0),
      energyRecords: Number(energyResult.rows[0]?.count ?? 0),
      waterRecords: Number(waterResult.rows[0]?.count ?? 0),
    };
  }
}
