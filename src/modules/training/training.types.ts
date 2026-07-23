import { z } from "zod";

export const TrainingStatusSchema = z.enum(["Scheduled", "In Progress", "Completed", "Expired", "Cancelled"]);
export type TrainingStatus = z.infer<typeof TrainingStatusSchema>;

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
export type TrainingCourse = z.infer<typeof TrainingCourseSchema> & { id: string; createdAt: string; updatedAt: string };
export const TrainingCourseInputSchema = TrainingCourseSchema.omit({ id: true });
export type TrainingCourseInput = z.infer<typeof TrainingCourseInputSchema>;

const TrainingRecordSchemaBase = z.object({
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

function refineTrainingRecordSchema<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (data: z.infer<typeof TrainingRecordSchemaBase>) => {
        if (!data.completedDate) return true;
        const scheduledDate = new Date(data.scheduledDate);
        const completedDate = new Date(data.completedDate);
        return (
          !Number.isNaN(scheduledDate.getTime()) &&
          !Number.isNaN(completedDate.getTime()) &&
          completedDate >= scheduledDate
        );
      },
      {
        message: "Completed date must be the same as or after the scheduled date",
        path: ["completedDate"],
      },
    )
    .refine(
      (data: z.infer<typeof TrainingRecordSchemaBase>) => {
        if (!data.expiryDate || !data.completedDate) return true;
        const completedDate = new Date(data.completedDate);
        const expiryDate = new Date(data.expiryDate);
        return (
          !Number.isNaN(completedDate.getTime()) &&
          !Number.isNaN(expiryDate.getTime()) &&
          expiryDate >= completedDate
        );
      },
      {
        message: "Expiry date must be the same as or after the completed date",
        path: ["expiryDate"],
      },
    )
    .refine(
      (data: z.infer<typeof TrainingRecordSchemaBase>) =>
        !data.expiryDate || Boolean(data.completedDate?.trim()),
      {
        message: "Completed date is required when an expiry date is provided",
        path: ["completedDate"],
      },
    );
}

export const TrainingRecordSchema = refineTrainingRecordSchema(TrainingRecordSchemaBase);
export type TrainingRecord = z.infer<typeof TrainingRecordSchema> & { id: string; createdAt: string; updatedAt: string };
export const TrainingRecordInputSchema = refineTrainingRecordSchema(
  TrainingRecordSchemaBase.omit({ id: true, recordNo: true }),
);
export type TrainingRecordInput = z.infer<typeof TrainingRecordInputSchema>;

export const TrainingMatrixSchema = z.object({
  id: z.string().optional(),
  role: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  courseId: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  mandatory: z.boolean().default(true),
  createdBy: z.string().min(1).max(200),
});
export type TrainingMatrix = z.infer<typeof TrainingMatrixSchema> & { id: string; createdAt: string; updatedAt: string };
export const TrainingMatrixInputSchema = TrainingMatrixSchema.omit({ id: true });
export type TrainingMatrixInput = z.infer<typeof TrainingMatrixInputSchema>;
