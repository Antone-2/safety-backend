import { OrganizationRepository } from "./organization.repository.js";
import type { CreateOrganizationDepartmentInput, CreateOrganizationSiteInput, OrganizationDepartmentFilters, OrganizationSiteFilters, UpdateOrganizationDepartmentInput, UpdateOrganizationSiteInput } from "./organization.types.js";
export declare class OrganizationService {
    private repository;
    constructor(repository: OrganizationRepository);
    listSites(filters: OrganizationSiteFilters): Promise<import("./organization.types.js").OrganizationSite[]>;
    listDepartments(filters: OrganizationDepartmentFilters): Promise<import("./organization.types.js").OrganizationDepartment[]>;
    getSiteById(id: string): Promise<import("./organization.types.js").OrganizationSite>;
    getDepartmentById(id: string): Promise<import("./organization.types.js").OrganizationDepartment>;
    createSite(input: CreateOrganizationSiteInput): Promise<import("./organization.types.js").OrganizationSite>;
    updateSite(id: string, input: UpdateOrganizationSiteInput): Promise<import("./organization.types.js").OrganizationSite>;
    deleteSite(id: string): Promise<boolean>;
    createDepartment(input: CreateOrganizationDepartmentInput): Promise<import("./organization.types.js").OrganizationDepartment>;
    updateDepartment(id: string, input: UpdateOrganizationDepartmentInput): Promise<import("./organization.types.js").OrganizationDepartment>;
    deleteDepartment(id: string): Promise<boolean>;
    getTree(): Promise<import("./organization.types.js").OrganizationTreeNode[]>;
    getStats(): Promise<import("./organization.types.js").OrganizationStats>;
    siteExists(name: string): Promise<boolean>;
    departmentExists(name: string): Promise<boolean>;
    departmentExistsForSite(name: string, siteName: string): Promise<boolean>;
}
