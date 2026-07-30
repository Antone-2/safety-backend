import type { AiQueryDomain, BaseQueryExecutionInput, Json, NonReportAiQueryDomain, QueryEngineDeps } from "./query-domain.contract.js";
export declare function detectAiQueryDomain(query: string): AiQueryDomain;
export declare class OperationalQueryEngine {
    private deps;
    private training;
    private permits;
    private handlers;
    constructor(deps: QueryEngineDeps);
    executeDomainQuery(domain: NonReportAiQueryDomain, input: BaseQueryExecutionInput): Promise<Json>;
    private executeTrainingQuery;
    private executeCapaQuery;
    private executePermitsQuery;
}
