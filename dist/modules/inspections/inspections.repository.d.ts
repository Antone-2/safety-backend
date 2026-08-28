import { Pool } from "pg";
import type { CreateInspectionInput, CreateInspectionTemplateInput, InspectionFinding, InspectionRecord, InspectionStats, InspectionTemplate, UpdateInspectionInput, UpdateInspectionTemplateInput } from "./inspections.types.js";
export declare class InspectionsRepository {
    private pool;
    constructor(pool: Pool);
    findTemplates(filters?: Record<string, unknown>): Promise<InspectionTemplate[]>;
    findTemplateById(id: string): Promise<InspectionTemplate | null>;
    createTemplate(data: CreateInspectionTemplateInput): Promise<InspectionTemplate>;
    updateTemplate(id: string, data: UpdateInspectionTemplateInput): Promise<InspectionTemplate | null>;
    findInspections(filters?: Record<string, unknown>): Promise<InspectionRecord[]>;
    findInspectionById(id: string): Promise<InspectionRecord | null>;
    createInspection(data: CreateInspectionInput): Promise<InspectionRecord | null>;
    updateInspection(id: string, data: UpdateInspectionInput): Promise<InspectionRecord | null>;
    deleteInspection(id: string): Promise<boolean>;
    findFindingsByInspectionIds(ids: string[]): Promise<Map<string, InspectionFinding[]>>;
    getStats(): Promise<InspectionStats>;
}
