import { WorkplaceRegistrationRepository } from "./workplace-registration.repository.js";
import type {
  CreateWorkplaceRegistrationInput,
  UpdateWorkplaceRegistrationInput,
  WorkplaceRegistration,
  WorkplaceRegistrationStats,
} from "./workplace-registration.types.js";

export class WorkplaceRegistrationService {
  constructor(private repository: WorkplaceRegistrationRepository) {}

  async getRegistrations(): Promise<WorkplaceRegistration[]> {
    await this.repository.seedDefaultsIfEmpty();
    return this.repository.findAll();
  }

  async getRegistrationById(id: string): Promise<WorkplaceRegistration | null> {
    return this.repository.findById(id);
  }

  async createRegistration(data: CreateWorkplaceRegistrationInput): Promise<WorkplaceRegistration> {
    return this.repository.create(data);
  }

  async updateRegistration(
    id: string,
    data: UpdateWorkplaceRegistrationInput,
  ): Promise<WorkplaceRegistration | null> {
    return this.repository.update(id, data);
  }

  async deleteRegistration(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async getStats(): Promise<WorkplaceRegistrationStats> {
    return this.repository.getStats();
  }
}

