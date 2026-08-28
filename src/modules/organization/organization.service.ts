import { ConflictError, NotFoundError, ValidationError } from "../../shared/domain/errors/index.js";
import { OrganizationRepository } from "./organization.repository.js";
import type {
  CreateOrganizationDepartmentInput,
  CreateOrganizationSiteInput,
  OrganizationDepartmentFilters,
  OrganizationSiteFilters,
  UpdateOrganizationDepartmentInput,
  UpdateOrganizationSiteInput,
} from "./organization.types.js";

export class OrganizationService {
  constructor(private repository: OrganizationRepository) {}

  async listSites(filters: OrganizationSiteFilters) {
    return this.repository.findSites(filters);
  }

  async listDepartments(filters: OrganizationDepartmentFilters) {
    return this.repository.findDepartments(filters);
  }

  async getSiteById(id: string) {
    const site = await this.repository.findSiteById(id);
    if (!site) throw new NotFoundError("Organization site");
    return site;
  }

  async getDepartmentById(id: string) {
    const department = await this.repository.findDepartmentById(id);
    if (!department) throw new NotFoundError("Organization department");
    return department;
  }

  async createSite(input: CreateOrganizationSiteInput) {
    const existing = await this.repository.findSiteByName(input.name);
    if (existing) throw new ConflictError("Site name already exists");
    return this.repository.createSite(input);
  }

  async updateSite(id: string, input: UpdateOrganizationSiteInput) {
    const existing = await this.getSiteById(id);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.repository.findSiteByName(input.name);
      if (duplicate && duplicate.id !== id) throw new ConflictError("Site name already exists");
    }
    const updated = await this.repository.updateSite(id, input);
    if (!updated) throw new NotFoundError("Organization site");
    return updated;
  }

  async deleteSite(id: string) {
    const existing = await this.getSiteById(id);
    const [departments, users] = await Promise.all([
      this.repository.countDepartmentsForSite(id),
      this.repository.countUsersForSite(existing.name),
    ]);
    if (departments > 0) {
      throw new ValidationError("Remove site departments before deleting the site");
    }
    if (users > 0) {
      throw new ValidationError("Reassign users before deleting the site");
    }
    return this.repository.deleteSite(id);
  }

  async createDepartment(input: CreateOrganizationDepartmentInput) {
    const site = await this.getSiteById(input.siteId);
    const existing = await this.repository.findDepartmentByNameForSite(input.name, site.name);
    if (existing) throw new ConflictError("Department already exists for this site");
    const created = await this.repository.createDepartment(input);
    if (!created) throw new ValidationError("Failed to create organization department");
    return created;
  }

  async updateDepartment(id: string, input: UpdateOrganizationDepartmentInput) {
    const existing = await this.getDepartmentById(id);
    const site =
      input.siteId && input.siteId !== existing.siteId
        ? await this.getSiteById(input.siteId)
        : { id: existing.siteId, name: existing.siteName };
    if (input.name || input.siteId) {
      const duplicate = await this.repository.findDepartmentByNameForSite(
        input.name ?? existing.name,
        site.name,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("Department already exists for this site");
      }
    }
    const updated = await this.repository.updateDepartment(id, input);
    if (!updated) throw new NotFoundError("Organization department");
    return updated;
  }

  async deleteDepartment(id: string) {
    const existing = await this.getDepartmentById(id);
    const users = await this.repository.countUsersForDepartment(existing.siteName, existing.name);
    if (users > 0) {
      throw new ValidationError("Reassign users before deleting the department");
    }
    return this.repository.deleteDepartment(id);
  }

  async getTree() {
    return this.repository.getTree();
  }

  async getStats() {
    return this.repository.getStats();
  }

  async siteExists(name: string) {
    return Boolean(await this.repository.findSiteByName(name));
  }

  async departmentExists(name: string) {
    return Boolean(await this.repository.findDepartmentByName(name));
  }

  async departmentExistsForSite(name: string, siteName: string) {
    return Boolean(await this.repository.findDepartmentByNameForSite(name, siteName));
  }
}
