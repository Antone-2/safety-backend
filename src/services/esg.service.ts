import { BaseService } from "./base.service.js";
import { z } from "zod";

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

export class EsgService {
  private carbonService: BaseService;
  private energyService: BaseService;
  private waterService: BaseService;

  constructor() {
    this.carbonService = new BaseService("carbon_emissions", CarbonEmissionSchema);
    this.energyService = new BaseService("energy_records", EnergyRecordSchema);
    this.waterService = new BaseService("water_records", WaterRecordSchema);
  }

  async createCarbonEmission(data: z.infer<typeof CarbonEmissionSchema>) {
    return this.carbonService.create(data);
  }

  async getCarbonEmissions(filters?: Record<string, any>) {
    return this.carbonService.getAll(filters);
  }

  async createEnergyRecord(data: z.infer<typeof EnergyRecordSchema>) {
    return this.energyService.create(data);
  }

  async getEnergyRecords(filters?: Record<string, any>) {
    return this.energyService.getAll(filters);
  }

  async createWaterRecord(data: z.infer<typeof WaterRecordSchema>) {
    return this.waterService.create(data);
  }

  async getWaterRecords(filters?: Record<string, any>) {
    return this.waterService.getAll(filters);
  }

  async getEsgDashboard() {
    const carbon = await this.carbonService.getAll();
    const energy = await this.energyService.getAll();
    const water = await this.waterService.getAll();
    const totalCO2 = carbon.reduce((sum: number, c: any) => sum + (c.co2Equivalent || 0), 0);
    const totalEnergy = energy.reduce((sum: number, e: any) => sum + (e.consumption || 0), 0);
    const totalWater = water.reduce((sum: number, w: any) => sum + (w.consumption || 0), 0);
    return {
      totalCO2,
      totalEnergy,
      totalWater,
      carbonRecords: carbon.length,
      energyRecords: energy.length,
      waterRecords: water.length,
    };
  }
}
