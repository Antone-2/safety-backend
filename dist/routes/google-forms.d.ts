declare const router: import("express-serve-static-core").Router;
export declare function setGoogleSheetsPostgresAvailability(available: boolean): void;
export declare function fetchGoogleSheetRows(formId: string, apiKey: string, requestedSheetName?: string): Promise<{
    rows: string[][];
    sheetName: string;
}>;
export declare function parseDate(dateStr?: string): string;
export declare function replaceGoogleSheetReportsInSqlite(db: any, reports: Array<{
    id: string;
    date: string;
    location: string;
    reporter: string;
    description: string;
    severity: string;
    status: string;
    category: string;
    type: string;
    slaHours: number;
    dueAt: string;
    anonymous: boolean;
    department: string;
    shift: string;
    complianceRequired: boolean;
    photoUrl: string;
}>): void;
export declare function buildReportIdForImportedRecord(imported: {
    date: string;
    location: string;
    reporter: string;
    description: string;
    category: string;
    type: string;
    severity: string;
}): string;
export declare function buildReportRecordFromRow(headers: string[], row: string[], defaults: {
    locations: string[];
    categories: string[];
    departments: string[];
}): {
    date: string;
    location: string;
    reporter: string;
    description: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    status: "Open" | "In Progress" | "Closed";
    category: string;
    type: "Unsafe Act" | "Unsafe Condition";
    anonymous: boolean;
    photoUrl: string;
    department: string;
    shift: string;
    slaHours: number;
    dueAt: string;
    complianceRequired: boolean;
};
export type GoogleSheetsSyncResult = {
    imported: number;
    rows: number;
    sheetName: string;
    startedAt: string;
    finishedAt: string;
};
export declare function runGoogleSheetsSync(options?: {
    spreadsheetId?: string;
    apiKey?: string;
    sheetName?: string;
    broadcast?: boolean;
}): Promise<GoogleSheetsSyncResult>;
export declare function queueGoogleSheetsSync(options?: Parameters<typeof runGoogleSheetsSync>[0]): Promise<GoogleSheetsSyncResult>;
export declare function startGoogleSheetsScheduler(intervalMs?: number): void;
export interface GoogleFormsErrorInfo {
    statusCode: number;
    message: string;
    details: string;
    hint: string;
}
export declare function classifyGoogleFormsError(error: unknown): GoogleFormsErrorInfo;
export default router;
