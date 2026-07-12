import { z } from "zod";
export declare const DashboardSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    type: z.ZodEnum<["Executive", "Management", "Operational", "Site", "Custom"]>;
    layout: z.ZodOptional<z.ZodString>;
    widgets: z.ZodOptional<z.ZodString>;
    filters: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "Operational" | "Executive" | "Management" | "Site" | "Custom";
    name: string;
    createdBy: string;
    role?: string | undefined;
    id?: string | undefined;
    department?: string | undefined;
    site?: string | undefined;
    layout?: string | undefined;
    widgets?: string | undefined;
    filters?: string | undefined;
}, {
    type: "Operational" | "Executive" | "Management" | "Site" | "Custom";
    name: string;
    createdBy: string;
    role?: string | undefined;
    id?: string | undefined;
    department?: string | undefined;
    site?: string | undefined;
    layout?: string | undefined;
    widgets?: string | undefined;
    filters?: string | undefined;
}>;
export declare const ReportSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    type: z.ZodEnum<["Incident", "CAPA", "Compliance", "Training", "Environmental", "Financial", "Custom"]>;
    format: z.ZodDefault<z.ZodEnum<["PDF", "Excel", "CSV", "JSON"]>>;
    parameters: z.ZodOptional<z.ZodString>;
    schedule: z.ZodOptional<z.ZodString>;
    recipients: z.ZodOptional<z.ZodString>;
    lastGenerated: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "Environmental" | "Incident" | "Custom" | "CAPA" | "Compliance" | "Training" | "Financial";
    name: string;
    createdBy: string;
    format: "PDF" | "Excel" | "CSV" | "JSON";
    id?: string | undefined;
    parameters?: string | undefined;
    schedule?: string | undefined;
    recipients?: string | undefined;
    lastGenerated?: string | undefined;
}, {
    type: "Environmental" | "Incident" | "Custom" | "CAPA" | "Compliance" | "Training" | "Financial";
    name: string;
    createdBy: string;
    id?: string | undefined;
    format?: "PDF" | "Excel" | "CSV" | "JSON" | undefined;
    parameters?: string | undefined;
    schedule?: string | undefined;
    recipients?: string | undefined;
    lastGenerated?: string | undefined;
}>;
export declare class AnalyticsService {
    private dashboardService;
    private reportService;
    constructor();
    createDashboard(data: z.infer<typeof DashboardSchema>): Promise<any>;
    getDashboards(filters?: Record<string, any>): Promise<any[]>;
    getDashboardById(id: string): Promise<any>;
    createReport(data: z.infer<typeof ReportSchema>): Promise<any>;
    getReports(filters?: Record<string, any>): Promise<any[]>;
    generateReport(id: string): Promise<any>;
    getAnalyticsStats(): Promise<{
        totalDashboards: number;
        totalReports: number;
        scheduledReports: number;
        generatedToday: number;
    }>;
}
