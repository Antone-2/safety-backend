import { z } from "zod";
export declare const OrganizationSiteSchema: z.ZodObject<{
    code: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    name: z.ZodString;
    region: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    country: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    managerName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    escalationEmail: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    active: boolean;
    createdBy: string;
    code?: string | undefined;
    region?: string | undefined;
    country?: string | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
}, {
    name: string;
    createdBy: string;
    code?: string | undefined;
    active?: boolean | undefined;
    region?: string | undefined;
    country?: string | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
}>;
export declare const OrganizationDepartmentSchema: z.ZodObject<{
    siteId: z.ZodString;
    code: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    name: z.ZodString;
    managerName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    escalationEmail: z.ZodOptional<z.ZodString>;
    active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    active: boolean;
    createdBy: string;
    siteId: string;
    code?: string | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
}, {
    name: string;
    createdBy: string;
    siteId: string;
    code?: string | undefined;
    active?: boolean | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
}>;
export declare const UpdateOrganizationSiteSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    name: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    country: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    managerName: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    escalationEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    active: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    region?: string | undefined;
    country?: string | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
    createdBy?: string | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    region?: string | undefined;
    country?: string | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
    createdBy?: string | undefined;
}>;
export declare const UpdateOrganizationDepartmentSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    name: z.ZodOptional<z.ZodString>;
    managerName: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>>;
    escalationEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    active: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
    createdBy: z.ZodOptional<z.ZodString>;
} & {
    siteId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
    createdBy?: string | undefined;
    siteId?: string | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    active?: boolean | undefined;
    managerName?: string | undefined;
    escalationEmail?: string | undefined;
    createdBy?: string | undefined;
    siteId?: string | undefined;
}>;
export declare const OrganizationSiteFiltersSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    active: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString]>>, boolean | undefined, string | boolean | undefined>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    search?: string | undefined;
}, {
    active?: string | boolean | undefined;
    search?: string | undefined;
}>;
export declare const OrganizationDepartmentFiltersSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    active: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString]>>, boolean | undefined, string | boolean | undefined>;
} & {
    siteId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    search?: string | undefined;
    siteId?: string | undefined;
}, {
    active?: string | boolean | undefined;
    search?: string | undefined;
    siteId?: string | undefined;
}>;
export type CreateOrganizationSiteInput = z.infer<typeof OrganizationSiteSchema>;
export type UpdateOrganizationSiteInput = z.infer<typeof UpdateOrganizationSiteSchema>;
export type CreateOrganizationDepartmentInput = z.infer<typeof OrganizationDepartmentSchema>;
export type UpdateOrganizationDepartmentInput = z.infer<typeof UpdateOrganizationDepartmentSchema>;
export type OrganizationSiteFilters = z.infer<typeof OrganizationSiteFiltersSchema>;
export type OrganizationDepartmentFilters = z.infer<typeof OrganizationDepartmentFiltersSchema>;
export type OrganizationSite = {
    id: string;
    code?: string;
    name: string;
    region?: string;
    country?: string;
    managerName?: string;
    escalationEmail?: string;
    active: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
};
export type OrganizationDepartment = {
    id: string;
    siteId: string;
    siteName: string;
    code?: string;
    name: string;
    managerName?: string;
    escalationEmail?: string;
    active: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
};
export type OrganizationTreeNode = OrganizationSite & {
    departments: OrganizationDepartment[];
};
export type OrganizationStats = {
    sites: number;
    activeSites: number;
    departments: number;
    activeDepartments: number;
};
