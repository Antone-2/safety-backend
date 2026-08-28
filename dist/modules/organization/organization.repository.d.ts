import { Pool } from "pg";
import type { CreateOrganizationDepartmentInput, CreateOrganizationSiteInput, OrganizationDepartment, OrganizationDepartmentFilters, OrganizationSite, OrganizationSiteFilters, OrganizationStats, OrganizationTreeNode, UpdateOrganizationDepartmentInput, UpdateOrganizationSiteInput } from "./organization.types.js";
export declare class OrganizationRepository {
    private pool;
    constructor(pool: Pool);
    findSites(filters?: OrganizationSiteFilters): Promise<OrganizationSite[]>;
    findSiteById(id: string): Promise<OrganizationSite | null>;
    findSiteByName(name: string): Promise<OrganizationSite | null>;
    createSite(input: CreateOrganizationSiteInput): Promise<OrganizationSite>;
    updateSite(id: string, input: UpdateOrganizationSiteInput): Promise<OrganizationSite | null>;
    deleteSite(id: string): Promise<boolean>;
    findDepartments(filters?: OrganizationDepartmentFilters): Promise<OrganizationDepartment[]>;
    findDepartmentById(id: string): Promise<OrganizationDepartment | null>;
    findDepartmentByName(name: string): Promise<OrganizationDepartment | null>;
    findDepartmentByNameForSite(name: string, siteName: string): Promise<OrganizationDepartment | null>;
    createDepartment(input: CreateOrganizationDepartmentInput): Promise<OrganizationDepartment | null>;
    updateDepartment(id: string, input: UpdateOrganizationDepartmentInput): Promise<OrganizationDepartment | null>;
    deleteDepartment(id: string): Promise<boolean>;
    getTree(): Promise<OrganizationTreeNode[]>;
    getStats(): Promise<OrganizationStats>;
    countUsersForSite(siteName: string): Promise<number>;
    countUsersForDepartment(siteName: string, departmentName: string): Promise<number>;
    countDepartmentsForSite(siteId: string): Promise<number>;
}
