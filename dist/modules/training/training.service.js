import { NotFoundError } from "../../shared/domain/errors/index.js";
export class TrainingService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getCourses() {
        return this.repository.findCourses();
    }
    async getCourseById(id) {
        return this.repository.findCourseById(id);
    }
    async createCourse(data) {
        return this.repository.createCourse(data);
    }
    async updateCourse(id, data) {
        const existing = await this.repository.findCourseById(id);
        if (!existing)
            throw new NotFoundError("Training course");
        return this.repository.updateCourse(id, data);
    }
    async deleteCourse(id) {
        const existing = await this.repository.findCourseById(id);
        if (!existing)
            return false;
        return this.repository.deleteCourse(id);
    }
    async getRecords(filters) {
        return this.repository.findRecords(filters);
    }
    async getRecordById(id) {
        return this.repository.findRecordById(id);
    }
    async createRecord(data) {
        return this.repository.createRecord(data);
    }
    async updateRecord(id, data) {
        const existing = await this.repository.findRecordById(id);
        if (!existing)
            throw new NotFoundError("Training record");
        return this.repository.updateRecord(id, data);
    }
    async deleteRecord(id) {
        const existing = await this.repository.findRecordById(id);
        if (!existing)
            return false;
        return this.repository.deleteRecord(id);
    }
    async getMatrix(filters) {
        return this.repository.findMatrix(filters);
    }
    async createMatrix(data) {
        return this.repository.createMatrix(data);
    }
    async deleteMatrix(id) {
        const matrices = await this.repository.findMatrix({ id });
        const existing = matrices[0];
        if (!existing)
            return false;
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
