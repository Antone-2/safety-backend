import { NotFoundError } from "../../shared/domain/errors/index.js";
import { CalibrationsRepository } from "./calibrations.repository.js";
import type { CreateCalibrationInput, UpdateCalibrationInput } from "./calibrations.types.js";

export class CalibrationsService {
  constructor(private repository: CalibrationsRepository) {}

  getRecords(filters?: Record<string, unknown>) {
    return this.repository.findAll(filters);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }

  create(data: CreateCalibrationInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateCalibrationInput) {
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError("Calibration record");
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError("Calibration record");
    return deleted;
  }

  getOverdue() {
    return this.repository.findOverdue();
  }

  getOutOfTolerance() {
    return this.repository.findOutOfTolerance();
  }

  getStats() {
    return this.repository.getStats();
  }
}
