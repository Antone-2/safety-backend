import { BaseService } from "./base.service.js";
import { z } from "zod";
export const TrainingStatusSchema = z.enum(["Scheduled", "In Progress", "Completed", "Expired", "Cancelled"]);
export const TrainingCourseSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    code: z.string().min(1).max(50),
    category: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    duration: z.number().min(0),
    frequency: z.string().min(1).max(100),
    validityMonths: z.number().optional(),
    competencyRequired: z.string().max(500).optional(),
    passingScore: z.number().min(0).max(100).default(70),
    createdBy: z.string().min(1).max(200),
});
export const TrainingRecordSchema = z.object({
    id: z.string().optional(),
    recordNo: z.string().optional(),
    courseId: z.string().min(1).max(100),
    employeeId: z.string().min(1).max(100),
    employeeName: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    site: z.string().min(1).max(200),
    status: TrainingStatusSchema.default("Scheduled"),
    scheduledDate: z.string().min(1),
    completedDate: z.string().optional(),
    trainer: z.string().max(200).optional(),
    score: z.number().optional(),
    passed: z.boolean().optional(),
    certificateUrl: z.string().optional(),
    expiryDate: z.string().optional(),
    feedback: z.string().max(2000).optional(),
    createdBy: z.string().min(1).max(200),
});
export const TrainingMatrixSchema = z.object({
    id: z.string().optional(),
    role: z.string().min(1).max(100),
    department: z.string().min(1).max(100),
    courseId: z.string().min(1).max(100),
    frequency: z.string().min(1).max(100),
    mandatory: z.boolean().default(true),
    createdBy: z.string().min(1).max(200),
});
export class TrainingService {
    courseService;
    recordService;
    matrixService;
    constructor() {
        this.courseService = new BaseService("training_courses", TrainingCourseSchema);
        this.recordService = new BaseService("training_records", TrainingRecordSchema);
        this.matrixService = new BaseService("training_matrix", TrainingMatrixSchema);
    }
    async createCourse(data) {
        return this.courseService.create({ ...data, createdBy: "System" });
    }
    async getCourses() { return this.courseService.getAll(); }
    async getCourseById(id) { return this.courseService.getById(id); }
    async createRecord(data) {
        const record = await this.recordService.create({ ...data, recordNo: `TRN-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getRecords(filters) { return this.recordService.getAll(filters); }
    async getRecordById(id) { return this.recordService.getById(id); }
    async getRecordsByEmployee(employeeId) { return this.recordService.getAll({ employeeId }); }
    async getRecordsByCourse(courseId) { return this.recordService.getAll({ courseId }); }
    async updateRecord(id, data) { return this.recordService.update(id, data); }
    async deleteRecord(id) { return this.recordService.delete(id); }
    async createMatrixEntry(data) {
        return this.matrixService.create(data);
    }
    async getMatrix(filters) { return this.matrixService.getAll(filters); }
    async getStats() {
        const db = this.getDb?.() || require("../lib/database.js").getDb();
        const all = this.allRows?.(db, `SELECT * FROM training_records`) || [];
        const total = all.length;
        const scheduled = all.filter((r) => r.status === "Scheduled").length;
        const completed = all.filter((r) => r.status === "Completed").length;
        const expired = all.filter((r) => r.status === "Expired").length;
        await this.saveDb?.(db) || require("../lib/database.js").saveDb(db);
        return { total, scheduled, completed, expired };
    }
}
