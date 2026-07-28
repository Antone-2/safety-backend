import { z } from "zod";
export declare const EsgCategorySchema: z.ZodEnum<["Environmental", "Social", "Governance"]>;
export type EsgCategory = z.infer<typeof EsgCategorySchema>;
export declare const CarbonEmissionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["Environmental", "Social", "Governance"]>;
    scope: z.ZodEnum<["Scope 1", "Scope 2", "Scope 3"]>;
    source: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    co2Equivalent: z.ZodNumber;
    period: z.ZodString;
    recordedDate: z.ZodString;
    site: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: string;
    site: string;
    createdBy: string;
    scope: "Scope 1" | "Scope 2" | "Scope 3";
    category: "Environmental" | "Social" | "Governance";
    quantity: number;
    unit: string;
    period: string;
    co2Equivalent: number;
    recordedDate: string;
    id?: string | undefined;
    description?: string | undefined;
    notes?: string | undefined;
}, {
    source: string;
    site: string;
    createdBy: string;
    scope: "Scope 1" | "Scope 2" | "Scope 3";
    category: "Environmental" | "Social" | "Governance";
    quantity: number;
    unit: string;
    period: string;
    co2Equivalent: number;
    recordedDate: string;
    id?: string | undefined;
    description?: string | undefined;
    notes?: string | undefined;
}>;
export declare const EnergyRecordSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["Electricity", "Diesel", "Petrol", "Natural Gas", "Solar", "Other"]>;
    consumption: z.ZodNumber;
    unit: z.ZodString;
    cost: z.ZodOptional<z.ZodNumber>;
    period: z.ZodString;
    recordedDate: z.ZodString;
    site: z.ZodString;
    meterReading: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: "Other" | "Electricity" | "Diesel" | "Petrol" | "Natural Gas" | "Solar";
    site: string;
    createdBy: string;
    unit: string;
    period: string;
    recordedDate: string;
    consumption: number;
    id?: string | undefined;
    notes?: string | undefined;
    cost?: number | undefined;
    meterReading?: number | undefined;
}, {
    source: "Other" | "Electricity" | "Diesel" | "Petrol" | "Natural Gas" | "Solar";
    site: string;
    createdBy: string;
    unit: string;
    period: string;
    recordedDate: string;
    consumption: number;
    id?: string | undefined;
    notes?: string | undefined;
    cost?: number | undefined;
    meterReading?: number | undefined;
}>;
export declare const WaterRecordSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["Municipal", "Borehole", "Rainwater", "Other"]>;
    consumption: z.ZodNumber;
    unit: z.ZodString;
    cost: z.ZodOptional<z.ZodNumber>;
    period: z.ZodString;
    recordedDate: z.ZodString;
    site: z.ZodString;
    recycled: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: "Other" | "Municipal" | "Borehole" | "Rainwater";
    site: string;
    createdBy: string;
    unit: string;
    period: string;
    recordedDate: string;
    consumption: number;
    id?: string | undefined;
    notes?: string | undefined;
    cost?: number | undefined;
    recycled?: number | undefined;
}, {
    source: "Other" | "Municipal" | "Borehole" | "Rainwater";
    site: string;
    createdBy: string;
    unit: string;
    period: string;
    recordedDate: string;
    consumption: number;
    id?: string | undefined;
    notes?: string | undefined;
    cost?: number | undefined;
    recycled?: number | undefined;
}>;
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
export declare class EsgService {
    createCarbonEmission(data: z.infer<typeof CarbonEmissionSchema>): Promise<CarbonEmission>;
    getCarbonEmissions(filters?: Record<string, unknown>): Promise<CarbonEmission[]>;
    updateCarbonEmission(id: string, data: Partial<z.infer<typeof CarbonEmissionSchema>>): Promise<CarbonEmission | null>;
    deleteCarbonEmission(id: string): Promise<boolean>;
    createEnergyRecord(data: z.infer<typeof EnergyRecordSchema>): Promise<EnergyRecord>;
    getEnergyRecords(filters?: Record<string, unknown>): Promise<EnergyRecord[]>;
    updateEnergyRecord(id: string, data: Partial<z.infer<typeof EnergyRecordSchema>>): Promise<EnergyRecord | null>;
    deleteEnergyRecord(id: string): Promise<boolean>;
    createWaterRecord(data: z.infer<typeof WaterRecordSchema>): Promise<WaterRecord>;
    getWaterRecords(filters?: Record<string, unknown>): Promise<WaterRecord[]>;
    updateWaterRecord(id: string, data: Partial<z.infer<typeof WaterRecordSchema>>): Promise<WaterRecord | null>;
    deleteWaterRecord(id: string): Promise<boolean>;
    getEsgDashboard(): Promise<{
        totalCO2: number;
        totalEnergy: number;
        totalWater: number;
        carbonRecords: number;
        energyRecords: number;
        waterRecords: number;
    }>;
}
export {};
