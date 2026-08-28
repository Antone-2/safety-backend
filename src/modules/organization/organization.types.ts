import { z } from "zod";

const nullableString = (max: number) =>
  z
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
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
});

export const OrganizationDepartmentFiltersSchema = OrganizationSiteFiltersSchema.extend({
  siteId: z.string().trim().uuid().optional(),
});

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
