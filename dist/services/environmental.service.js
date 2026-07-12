import { BaseService } from "./base.service.js";
import { z } from "zod";
export const WasteTypeSchema = z.enum(["Hazardous", "Non-Hazardous", "Recyclable", "Organic", "E-Waste", "Chemical"]);
export const WasteSchema = z.object({
    id: z.string().optional(),
    type: WasteTypeSchema,
    category: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(20),
    generatedDate: z.string().min(1),
    storedLocation: z.string().min(1).max(200),
    disposedDate: z.string().optional(),
    disposalMethod: z.string().max(200).optional(),
    disposalContractor: z.string().max(200).optional(),
    manifestNumber: z.string().max(100).optional(),
    status: z.string().default("Stored"),
    photoUrl: z.string().optional(),
    notes: z.string().max(500).optional(),
    createdBy: z.string().min(1).max(200),
});
export const EmissionSchema = z.object({
    id: z.string().optional(),
    type: z.enum(["Air", "Water", "Noise", "Vibration"]),
    parameter: z.string().min(1).max(100),
    location: z.string().min(1).max(200),
    value: z.number(),
    unit: z.string().min(1).max(20),
    limit: z.number().optional(),
    monitoredDate: z.string().min(1),
    monitoredBy: z.string().min(1).max(200),
    equipment: z.string().max(200).optional(),
    correctiveAction: z.string().max(1000).optional(),
    status: z.string().default("Within Limit"),
    createdBy: z.string().min(1).max(200),
});
export const ChemicalSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    casNumber: z.string().max(50).optional(),
    formula: z.string().max(100).optional(),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(20),
    storageLocation: z.string().min(1).max(200),
    hazardClass: z.string().max(100).optional(),
    sdsUrl: z.string().optional(),
    expiryDate: z.string().optional(),
    supplier: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
    createdBy: z.string().min(1).max(200),
});
export const SpillSchema = z.object({
    id: z.string().optional(),
    chemical: z.string().min(1).max(200),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(20),
    location: z.string().min(1).max(200),
    date: z.string().min(1),
    time: z.string().min(1),
    severity: z.enum(["Minor", "Major", "Critical"]),
    affectedArea: z.string().max(500).optional(),
    responseActions: z.string().max(2000).optional(),
    cleanupCompleted: z.boolean().default(false),
    cleanupDate: z.string().optional(),
    reportedToNema: z.boolean().default(false),
    nemaReportDate: z.string().optional(),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export class EnvironmentalService {
    wasteService;
    emissionService;
    chemicalService;
    spillService;
    constructor() {
        this.wasteService = new BaseService("waste_records", WasteSchema);
        this.emissionService = new BaseService("emissions", EmissionSchema);
        this.chemicalService = new BaseService("chemicals", ChemicalSchema);
        this.spillService = new BaseService("spills", SpillSchema);
    }
    async createWaste(data) {
        return this.wasteService.create(data);
    }
    async getWaste(filters) {
        return this.wasteService.getAll(filters);
    }
    async createEmission(data) {
        return this.emissionService.create(data);
    }
    async getEmissions(filters) {
        return this.emissionService.getAll(filters);
    }
    async createChemical(data) {
        return this.chemicalService.create(data);
    }
    async getChemicals() {
        return this.chemicalService.getAll();
    }
    async createSpill(data) {
        return this.spillService.create(data);
    }
    async getSpills(filters) {
        return this.spillService.getAll(filters);
    }
    async getEnvironmentalStats() {
        const waste = await this.wasteService.getAll();
        const emissions = await this.emissionService.getAll();
        const chemicals = await this.chemicalService.getAll();
        const spills = await this.spillService.getAll();
        return {
            totalWaste: waste.length,
            hazardousWaste: waste.filter((w) => w.type === "Hazardous").length,
            totalEmissions: emissions.length,
            exceedances: emissions.filter((e) => e.status !== "Within Limit").length,
            totalChemicals: chemicals.length,
            totalSpills: spills.length,
            majorSpills: spills.filter((s) => s.severity === "Major" || s.severity === "Critical").length,
        };
    }
}
