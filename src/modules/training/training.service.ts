import { TrainingCourse, TrainingCourseInput, TrainingRecord, TrainingRecordInput, TrainingMatrix, TrainingMatrixInput } from "./training.types.js";
import { TrainingRepository } from "./training.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class TrainingService {
  constructor(private repository: TrainingRepository) {}

  async getCourses() {
    return this.repository.findCourses();
  }

  async getCourseById(id: string) {
    return this.repository.findCourseById(id);
  }

  async createCourse(data: TrainingCourseInput) {
    return this.repository.createCourse(data);
  }

  async updateCourse(id: string, data: Partial<TrainingCourseInput>) {
    const existing = await this.repository.findCourseById(id);
    if (!existing) throw new NotFoundError("Training course");
    return this.repository.updateCourse(id, data);
  }

  async deleteCourse(id: string) {
    const existing = await this.repository.findCourseById(id);
    if (!existing) return false;
    return this.repository.deleteCourse(id);
  }

  async getRecords(filters?: Record<string, unknown>) {
    return this.repository.findRecords(filters);
  }

  async getRecordById(id: string) {
    return this.repository.findRecordById(id);
  }

  async createRecord(data: TrainingRecordInput) {
    return this.repository.createRecord(data);
  }

  async updateRecord(id: string, data: Partial<TrainingRecordInput>) {
    const existing = await this.repository.findRecordById(id);
    if (!existing) throw new NotFoundError("Training record");
    return this.repository.updateRecord(id, data);
  }

  async deleteRecord(id: string) {
    const existing = await this.repository.findRecordById(id);
    if (!existing) return false;
    return this.repository.deleteRecord(id);
  }

  async getMatrix(filters?: Record<string, unknown>) {
    return this.repository.findMatrix(filters);
  }

  async createMatrix(data: TrainingMatrixInput) {
    return this.repository.createMatrix(data);
  }

  async deleteMatrix(id: string) {
    const matrices = await this.repository.findMatrix({ id });
    const existing = matrices[0];
    if (!existing) return false;
    return this.repository.deleteMatrix(id);
  }

  async getStats() {
    const total = await this.repository.countRecords();
    const scheduled = await this.repository.countRecords({ status: "Scheduled" });
    const completed = await this.repository.countRecords({ status: "Completed" });
    const expired = await this.repository.countRecords({ status: "Expired" });
    return { total, scheduled, completed, expired };
  }
}
