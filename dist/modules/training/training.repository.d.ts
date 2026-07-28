import { Pool } from "pg";
import type { TrainingCourse, TrainingCourseInput, TrainingRecordInput, TrainingMatrix, TrainingMatrixInput, UpdateTrainingMatrixInput } from "./training.types.js";
export declare class TrainingRepository {
    private pool;
    constructor(pool: Pool);
    findCourses(): Promise<TrainingCourse[]>;
    findCourseById(id: string): Promise<TrainingCourse | null>;
    createCourse(data: TrainingCourseInput): Promise<TrainingCourse>;
    updateCourse(id: string, data: Partial<TrainingCourseInput>): Promise<TrainingCourse | null>;
    deleteCourse(id: string): Promise<boolean>;
    findRecords(filters?: Record<string, unknown>): Promise<any[]>;
    findRecordById(id: string): Promise<any>;
    createRecord(data: TrainingRecordInput): Promise<any>;
    updateRecord(id: string, data: Partial<TrainingRecordInput>): Promise<any>;
    deleteRecord(id: string): Promise<boolean>;
    findMatrix(filters?: Record<string, unknown>): Promise<TrainingMatrix[]>;
    findMatrixById(id: string): Promise<TrainingMatrix | null>;
    createMatrix(data: TrainingMatrixInput): Promise<TrainingMatrix>;
    updateMatrix(id: string, data: UpdateTrainingMatrixInput): Promise<TrainingMatrix | null>;
    deleteMatrix(id: string): Promise<boolean>;
    countRecords(filters?: Record<string, unknown>): Promise<number>;
}
