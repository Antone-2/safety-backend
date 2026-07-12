import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, allRows } from "../lib/database.js";
export const FireEquipmentTypeSchema = z.enum(["Extinguisher", "Hydrant", "Alarm", "Sprinkler", "EmergencyLight", "FireDoor", "Detector"]);
export const FireEquipmentSchema = z.object({
    id: z.string().optional(),
    type: FireEquipmentTypeSchema,
    location: z.string().min(1).max(200),
    building: z.string().min(1).max(100),
    floor: z.string().max(50).optional(),
    room: z.string().max(100).optional(),
    assetTag: z.string().min(1).max(100),
    manufacturer: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serialNumber: z.string().max(100).optional(),
    installationDate: z.string().optional(),
    lastInspectionDate: z.string().optional(),
    nextInspectionDate: z.string().optional(),
    inspectionFrequency: z.string().max(50).optional(),
    status: z.string().default("Operational"),
    notes: z.string().max(500).optional(),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export const FireInspectionSchema = z.object({
    id: z.string().optional(),
    equipmentId: z.string().min(1).max(100),
    inspector: z.string().min(1).max(200),
    inspectionDate: z.string().min(1),
    findings: z.string().max(2000).optional(),
    defects: z.string().max(1000).optional(),
    actionRequired: z.string().max(1000).optional(),
    passed: z.boolean(),
    nextInspectionDue: z.string().min(1),
    photoUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export class FireService {
    equipmentService;
    inspectionService;
    constructor() {
        this.equipmentService = new BaseService("fire_equipment", FireEquipmentSchema);
        this.inspectionService = new BaseService("fire_inspections", FireInspectionSchema);
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
        const rows = allRows(db, `SELECT * FROM fire_equipment WHERE nextInspectionDate < ?`, [new Date().toISOString()]);
        return rows;
    }
    async getFireStats() {
        const equipment = await this.equipmentService.getAll();
        const inspections = await this.inspectionService.getAll();
        const totalEquipment = equipment.length;
        const operational = equipment.filter((e) => e.status === "Operational").length;
        const defective = equipment.filter((e) => e.status === "Defective").length;
        const overdueInspections = equipment.filter((e) => e.nextInspectionDate && new Date(e.nextInspectionDate) < new Date()).length;
        return { totalEquipment, operational, defective, overdueInspections, totalInspections: inspections.length };
    }
}
