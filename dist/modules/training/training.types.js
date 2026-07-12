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
export const TrainingCourseInputSchema = TrainingCourseSchema.omit({ id: true });
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
export const TrainingRecordInputSchema = TrainingRecordSchema.omit({ id: true, recordNo: true });
export const TrainingMatrixSchema = z.object({
    id: z.string().optional(),
    role: z.string().min(1).max(100),
    department: z.string().min(1).max(100),
    courseId: z.string().min(1).max(100),
    frequency: z.string().min(1).max(100),
    mandatory: z.boolean().default(true),
    createdBy: z.string().min(1).max(200),
});
export const TrainingMatrixInputSchema = TrainingMatrixSchema.omit({ id: true });
