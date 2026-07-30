import type { BaseQueryExecutionInput, Json, QueryEngineDeps } from "./query-domain.contract.js";
export declare class ReportQueryEngine {
    private deps;
    private reports;
    constructor(deps: QueryEngineDeps);
    private getReportSummary;
    private getTopReporters;
    private generateEvidenceBoundAnswer;
    executeReportQuery(input: BaseQueryExecutionInput): Promise<Json>;
}
