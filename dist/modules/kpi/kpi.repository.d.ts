import { Pool } from "pg";
import type { KpiDefinition, KpiValue, CreateKpiDefinitionInput, UpdateKpiDefinitionInput, CreateKpiValueInput, UpdateKpiValueInput, KpiDashboardSummary } from "./kpi.types.js";
export declare class KpiRepository {
    private pool;
    constructor(pool: Pool);
    getDefinitions(filters?: {
        category?: string;
        isActive?: boolean;
    }): Promise<KpiDefinition[]>;
    getDefinitionById(id: string): Promise<KpiDefinition | null>;
    createDefinition(data: CreateKpiDefinitionInput): Promise<KpiDefinition>;
    updateDefinition(id: string, data: UpdateKpiDefinitionInput): Promise<KpiDefinition | null>;
    deleteDefinition(id: string): Promise<boolean>;
    getValues(filters?: {
        definitionId?: string;
        periodStart?: string;
        periodEnd?: string;
    }): Promise<KpiValue[]>;
    getValueById(id: string): Promise<KpiValue | null>;
    getValuesForPeriod(definitionId: string, periodStart: string, periodEnd: string): Promise<KpiValue | null>;
    createValue(data: CreateKpiValueInput): Promise<KpiValue>;
    updateValue(id: string, data: UpdateKpiValueInput): Promise<KpiValue | null>;
    deleteValue(id: string): Promise<boolean>;
    getDashboard(): Promise<KpiDashboardSummary>;
}
