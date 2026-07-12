export declare function buildCapaReminderHtml(capaId: string, dueDate: string, action: string): string;
export declare function buildIncidentAlertHtml(incident: {
    id: string;
    severity: string;
    location: string;
    description: string;
    date: string;
}): string;
export declare function buildAssignmentHtml(incident: {
    id: string;
    severity: string;
    location: string;
    description: string;
}, assignee: string): string;
