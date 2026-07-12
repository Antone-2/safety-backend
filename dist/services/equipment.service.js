import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, allRows } from "../lib/database.js";
export const EquipmentTypeSchema = z.enum(["Extinguisher", "Hydrant", "Alarm", "Sprinkler", "EmergencyLight", "FireDoor", "Detector", "PPE", "SafetyEquipment", "Monitoring"]);
export const EquipmentSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    type: EquipmentTypeSchema,
    category: z.string().min(1).max(100),
    assetTag: z.string().min(1).max(100),
    serialNumber: z.string().max(100).optional(),
    manufacturer: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    location: z.string().min(1).max(200),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    purchaseDate: z.string().optional(),
    installationDate: z.string().optional(),
    warrantyExpiry: z.string().optional(),
    lastInspectionDate: z.string().optional(),
    nextInspectionDate: z.string().optional(),
    inspectionFrequency: z.string().max(50).optional(),
    status: z.string().default("Operational"),
    condition: z.string().max(100).optional(),
    assignedTo: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export const EquipmentInspectionSchema = z.object({
    id: z.string().optional(),
    equipmentId: z.string().min(1).max(100),
    inspector: z.string().min(1).max(200),
    inspectionDate: z.string().min(1),
    inspectionType: z.string().min(1).max(100),
    findings: z.string().max(2000).optional(),
    defects: z.string().max(1000).optional(),
    actionRequired: z.string().max(1000).optional(),
    passed: z.boolean(),
    nextInspectionDue: z.string().min(1),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export class EquipmentService {
    equipmentService;
    inspectionService;
    constructor() {
        this.equipmentService = new BaseService("equipment", EquipmentSchema);
        this.inspectionService = new BaseService("equipment_inspections", EquipmentInspectionSchema);
    }
    async createEquipment(data) {
        return this.equipmentService.create(data);
    }
    async getEquipment(filters) {
        return this.equipmentService.getAll(filters);
    }
    async getEquipmentById(id) {
        return this.equipmentService.getById(id);
    }
    async updateEquipment(id, data) {
        return this.equipmentService.update(id, data);
    }
    async createInspection(data) {
        const inspection = await this.inspectionService.create(data);
        await this.equipmentService.update(data.equipmentId, {
            lastInspectionDate: data.inspectionDate,
            nextInspectionDate: data.nextInspectionDue,
        });
        return inspection;
    }
    async getInspections(filters) {
        return this.inspectionService.getAll(filters);
    }
    async getOverdueInspections() {
        const db = await getDb();
        const rows = allRows(db, `SELECT * FROM equipment WHERE nextInspectionDate < ? AND status != 'Retired'`, [new Date().toISOString()]);
        return rows;
    }
    async getEquipmentStats() {
        const equipment = await this.equipmentService.getAll();
        const total = equipment.length;
        const operational = equipment.filter((e) => e.status === "Operational").length;
        const maintenance = equipment.filter((e) => e.status === "Under Maintenance").length;
        const retired = equipment.filter((e) => e.status === "Retired").length;
        return { total, operational, maintenance, retired };
    }
}
