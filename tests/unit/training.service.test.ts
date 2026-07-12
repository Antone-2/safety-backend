import { describe, expect, it, vi } from "vitest";

const mockRepository = {
  findCourses: vi.fn().mockResolvedValue([
    {
      id: "CRS-1",
      title: "First Aid",
      code: "FA-001",
      category: "Medical",
      description: "Basic first aid course",
      duration: 8,
      frequency: "Annual",
      validityMonths: 12,
      competencyRequired: "None",
      passingScore: 80,
      createdBy: "EHS Manager",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
  findCourseById: vi.fn().mockResolvedValue(null),
  createCourse: vi.fn().mockResolvedValue({
    id: "CRS-2",
    title: "New",
    code: "N1",
    category: "Cat",
    description: undefined,
    duration: 10,
    frequency: "Monthly",
    validityMonths: null,
    competencyRequired: null,
    passingScore: 80,
    createdBy: "Admin",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  }),
  updateCourse: vi.fn().mockResolvedValue(null),
  deleteCourse: vi.fn().mockResolvedValue(true),
  findRecords: vi.fn().mockResolvedValue([
    {
      id: "REC-1",
      recordNo: "TRN-2026-0001",
      courseId: "CRS-1",
      employeeId: "EMP-1",
      employeeName: "John Doe",
      department: "Production",
      site: "Factory A",
      status: "Scheduled",
      scheduledDate: "2026-07-15T00:00:00.000Z",
      completedDate: undefined,
      trainer: "Jane Smith",
      score: undefined,
      passed: undefined,
      certificateUrl: undefined,
      expiryDate: undefined,
      feedback: undefined,
      createdBy: "System",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ]),
  findRecordById: vi.fn().mockResolvedValue(null),
  createRecord: vi.fn().mockResolvedValue({ id: "REC-2" }),
  updateRecord: vi.fn().mockResolvedValue(null),
  deleteRecord: vi.fn().mockResolvedValue(true),
  findMatrix: vi.fn().mockResolvedValue([]),
  createMatrix: vi.fn().mockResolvedValue({ id: "MTX-1" }),
  deleteMatrix: vi.fn().mockResolvedValue(true),
  countRecords: vi.fn().mockImplementation((filters?: Record<string, unknown>) => {
    if (filters && filters.status === "Completed") return 1;
    return 2;
  }),
};

vi.mock("../../src/modules/training/training.repository.js", () => ({
  TrainingRepository: class {
    pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    findCourses = mockRepository.findCourses;
    findCourseById = mockRepository.findCourseById;
    createCourse = mockRepository.createCourse;
    updateCourse = mockRepository.updateCourse;
    deleteCourse = mockRepository.deleteCourse;
    findRecords = mockRepository.findRecords;
    findRecordById = mockRepository.findRecordById;
    createRecord = mockRepository.createRecord;
    updateRecord = mockRepository.updateRecord;
    deleteRecord = mockRepository.deleteRecord;
    findMatrix = mockRepository.findMatrix;
    createMatrix = mockRepository.createMatrix;
    deleteMatrix = mockRepository.deleteMatrix;
    countRecords = mockRepository.countRecords;
  },
}));

describe("TrainingService", () => {
  it("returns all courses", async () => {
    const { TrainingService } = await import("../../src/modules/training/training.service.js");
    const repository = new (await import("../../src/modules/training/training.repository.js")).TrainingRepository();
    const service = new TrainingService(repository);
    const courses = await service.getCourses();
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe("First Aid");
  }, 10000);

  it("creates a course", async () => {
    const { TrainingService } = await import("../../src/modules/training/training.service.js");
    const repository = new (await import("../../src/modules/training/training.repository.js")).TrainingRepository();
    const service = new TrainingService(repository);
    const course = await service.createCourse({
      title: "New",
      code: "N1",
      category: "Cat",
      duration: 10,
      frequency: "Monthly",
      createdBy: "Admin",
    });
    expect(course.id).toBe("CRS-2");
  }, 10000);

  it("returns training stats", async () => {
    const { TrainingService } = await import("../../src/modules/training/training.service.js");
    const repository = new (await import("../../src/modules/training/training.repository.js")).TrainingRepository();
    const service = new TrainingService(repository);
    const stats = await service.getStats();
    expect(stats.total).toBe(2);
  });
});
