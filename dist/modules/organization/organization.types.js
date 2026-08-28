import { z } from "zod";
const nullableString = (max) => z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
export const OrganizationSiteSchema = z.object({
    code: nullableString(40),
    name: z.string().trim().min(1).max(200),
    region: nullableString(120),
    country: nullableString(120),
    managerName: nullableString(200),
    escalationEmail: z.string().trim().email().optional(),
    active: z.boolean().optional().default(true),
    createdBy: z.string().trim().min(1).max(200),
});
export const OrganizationDepartmentSchema = z.object({
    siteId: z.string().trim().uuid(),
    code: nullableString(40),
    name: z.string().trim().min(1).max(160),
    managerName: nullableString(200),
    escalationEmail: z.string().trim().email().optional(),
    active: z.boolean().optional().default(true),
    createdBy: z.string().trim().min(1).max(200),
});
export const UpdateOrganizationSiteSchema = OrganizationSiteSchema.partial();
export const UpdateOrganizationDepartmentSchema = OrganizationDepartmentSchema.partial().extend({
    siteId: z.string().trim().uuid().optional(),
});
export const OrganizationSiteFiltersSchema = z.object({
    search: z.string().trim().optional(),
    active: z
        .union([z.boolean(), z.string().trim()])
        .optional()
        .transform((value) => {
        if (typeof value === "boolean")
            return value;
        if (value === "true")
            return true;
        if (value === "false")
            return false;
        return undefined;
    }),
});
export const OrganizationDepartmentFiltersSchema = OrganizationSiteFiltersSchema.extend({
    siteId: z.string().trim().uuid().optional(),
});
