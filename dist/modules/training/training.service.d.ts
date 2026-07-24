import { TrainingCourse, TrainingCourseInput, TrainingRecordInput, TrainingMatrix, TrainingMatrixInput } from "./training.types.js";
import { TrainingRepository } from "./training.repository.js";
export declare class TrainingService {
    private repository;
    constructor(repository: TrainingRepository);
    getCourses(): Promise<TrainingCourse[]>;
    getCourseById(id: string): Promise<TrainingCourse | null>;
    createCourse(data: TrainingCourseInput): Promise<TrainingCourse>;
    updateCourse(id: string, data: Partial<TrainingCourseInput>): Promise<TrainingCourse | null>;
    deleteCourse(id: string): Promise<boolean>;
    getRecords(filters?: Record<string, unknown>): Promise<any[]>;
    getRecordById(id: string): Promise<any>;
    createRecord(data: TrainingRecordInput): Promise<any>;
    updateRecord(id: string, data: Partial<TrainingRecordInput>): Promise<any>;
    deleteRecord(id: string): Promise<boolean>;
    getMatrix(filters?: Record<string, unknown>): Promise<TrainingMatrix[]>;
    createMatrix(data: TrainingMatrixInput): Promise<TrainingMatrix>;
    deleteMatrix(id: string): Promise<boolean>;
    getStats(): Promise<{
        total: number;
        scheduled: number;
        completed: number;
        expired: number;
    }>;
}
