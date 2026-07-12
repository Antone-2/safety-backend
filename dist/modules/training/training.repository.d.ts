import { Pool } from "pg";
import type { TrainingCourse, TrainingCourseInput, TrainingRecord, TrainingRecordInput, TrainingMatrix, TrainingMatrixInput } from "./training.types.js";
export declare class TrainingRepository {
    private pool;
    constructor(pool: Pool);
    findCourses(): Promise<TrainingCourse[]>;
    findCourseById(id: string): Promise<TrainingCourse | null>;
    createCourse(data: TrainingCourseInput): Promise<TrainingCourse>;
    updateCourse(id: string, data: Partial<TrainingCourseInput>): Promise<TrainingCourse | null>;
    deleteCourse(id: string): Promise<boolean>;
    findRecords(filters?: Record<string, unknown>): Promise<TrainingRecord[]>;
    findRecordById(id: string): Promise<TrainingRecord | null>;
    createRecord(data: TrainingRecordInput): Promise<TrainingRecord>;
    updateRecord(id: string, data: Partial<TrainingRecordInput>): Promise<TrainingRecord | null>;
    deleteRecord(id: string): Promise<boolean>;
    findMatrix(filters?: Record<string, unknown>): Promise<TrainingMatrix[]>;
    createMatrix(data: TrainingMatrixInput): Promise<TrainingMatrix>;
    deleteMatrix(id: string): Promise<boolean>;
    countRecords(filters?: Record<string, unknown>): Promise<number>;
}
