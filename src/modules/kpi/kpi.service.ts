import { KpiRepository } from "./kpi.repository.js";
import type {
  CreateKpiDefinitionInput,
  UpdateKpiDefinitionInput,
  CreateKpiValueInput,
  UpdateKpiValueInput,
  KpiDefinition,
  KpiValue,
  KpiDashboardSummary,
} from "./kpi.types.js";

export class KpiService {
  constructor(private repository: KpiRepository) {}

  async getDefinitions(filters?: { category?: string; isActive?: boolean }): Promise<KpiDefinition[]> {
    return this.repository.getDefinitions(filters);
  }

  async getDefinitionById(id: string): Promise<KpiDefinition | null> {
    return this.repository.getDefinitionById(id);
  }

  async createDefinition(data: CreateKpiDefinitionInput): Promise<KpiDefinition> {
    return this.repository.createDefinition(data);
  }

  async updateDefinition(id: string, data: UpdateKpiDefinitionInput): Promise<KpiDefinition | null> {
    return this.repository.updateDefinition(id, data);
  }

  async deleteDefinition(id: string): Promise<boolean> {
    return this.repository.deleteDefinition(id);
  }

  async getValues(filters?: { definitionId?: string; periodStart?: string; periodEnd?: string }): Promise<KpiValue[]> {
    return this.repository.getValues(filters);
  }

  async getValueById(id: string): Promise<KpiValue | null> {
    return this.repository.getValueById(id);
  }

  async createValue(data: CreateKpiValueInput): Promise<KpiValue> {
    return this.repository.createValue(data);
  }

  async updateValue(id: string, data: UpdateKpiValueInput): Promise<KpiValue | null> {
    return this.repository.updateValue(id, data);
  }

  async deleteValue(id: string): Promise<boolean> {
    return this.repository.deleteValue(id);
  }

  async getDashboard(): Promise<KpiDashboardSummary> {
    return this.repository.getDashboard();
  }
}
