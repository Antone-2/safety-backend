import { BaseService } from "./base.service.js";
import { z } from "zod";

export const DashboardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["Executive", "Management", "Operational", "Site", "Custom"]),
  layout: z.string().max(5000).optional(),
  widgets: z.string().max(5000).optional(),
  filters: z.string().max(2000).optional(),
  site: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  createdBy: z.string().min(1).max(200),
});

export const ReportSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["Incident", "CAPA", "Compliance", "Training", "Environmental", "Financial", "Custom"]),
  format: z.enum(["PDF", "Excel", "CSV", "JSON"]).default("PDF"),
  parameters: z.string().max(2000).optional(),
  schedule: z.string().max(500).optional(),
  recipients: z.string().max(1000).optional(),
  lastGenerated: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});

export class AnalyticsService {
  private dashboardService: BaseService;
  private reportService: BaseService;

  constructor() {
    this.dashboardService = new BaseService("dashboards", DashboardSchema);
    this.reportService = new BaseService("reports", ReportSchema);
  }

  async createDashboard(data: z.infer<typeof DashboardSchema>) {
    return this.dashboardService.create(data);
  }

  async getDashboards(filters?: Record<string, any>) {
    return this.dashboardService.getAll(filters);
  }

  async getDashboardById(id: string) {
    return this.dashboardService.getById(id);
  }

  async createReport(data: z.infer<typeof ReportSchema>) {
    return this.reportService.create(data);
  }

  async getReports(filters?: Record<string, any>) {
    return this.reportService.getAll(filters);
  }

  async generateReport(id: string) {
    const report = await this.reportService.getById(id);
    if (!report) throw new Error("Report not found");
    const generatedAt = new Date().toISOString();
    await this.reportService.update(id, { lastGenerated: generatedAt });
    return { ...report, lastGenerated: generatedAt, status: "Generated" };
  }

  async getAnalyticsStats() {
    const dashboards = await this.dashboardService.getAll();
    const reports = await this.reportService.getAll();
    return {
      totalDashboards: dashboards.length,
      totalReports: reports.length,
      scheduledReports: reports.filter((r: any) => r.schedule).length,
      generatedToday: reports.filter((r: any) => r.lastGenerated && new Date(r.lastGenerated).toDateString() === new Date().toDateString()).length,
    };
  }
}
