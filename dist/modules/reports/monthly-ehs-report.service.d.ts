type MetricCard = {
    key: string;
    label: string;
    value: string;
    change: string;
    direction: "up" | "down" | "flat";
    sparkline: number[];
    description: string;
};
type IncidentRecord = {
    id: string;
    date: string;
    type: string;
    location: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    status: string;
    department: string;
    site: string;
    description: string;
};
type CapaItem = {
    id: string;
    title: string;
    owner: string;
    dueDate: string;
    status: "Open" | "Closed";
    severity: "Low" | "Medium" | "High" | "Critical";
};
type TrainingItem = {
    name: string;
    department: string;
    completion: number;
    expiryDate: string;
    status: "On track" | "Expiring soon" | "Expired";
};
type SitePerformance = {
    name: string;
    incidents: number;
    riskScore: "Low" | "Medium" | "High";
    trend: "Stable" | "Watch" | "Needs attention";
};
export type MonthlyEhsReportPayload = {
    month: string;
    model: {
        metrics: MetricCard[];
        trendData: Array<{
            month: string;
            incidents: number;
            closed: number;
            open: number;
        }>;
        capaTrendData: Array<{
            month: string;
            opened: number;
            closed: number;
            overdue: number;
        }>;
        incidentTypes: Array<{
            name: string;
            value: number;
        }>;
        departmentPerformance: Array<{
            name: string;
            value: number;
        }>;
        incidents: IncidentRecord[];
        capas: CapaItem[];
        training: TrainingItem[];
        sites: SitePerformance[];
        notifications: Array<{
            title: string;
            detail: string;
            href: string;
        }>;
        summaryText: string;
    };
    currentFocus: string;
};
export declare function getMonthlyEhsReport(month?: string): Promise<MonthlyEhsReportPayload>;
export {};
