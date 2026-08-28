import { InspectionsRepository } from "./inspections.repository.js";
import type { CreateInspectionInput, CreateInspectionTemplateInput, UpdateInspectionInput, UpdateInspectionTemplateInput } from "./inspections.types.js";
export declare class InspectionsService {
    private repository;
    constructor(repository: InspectionsRepository);
    getTemplates(filters?: Record<string, unknown>): Promise<import("./inspections.types.js").InspectionTemplate[]>;
    getTemplateById(id: string): Promise<import("./inspections.types.js").InspectionTemplate | null>;
    createTemplate(data: CreateInspectionTemplateInput): Promise<import("./inspections.types.js").InspectionTemplate>;
    updateTemplate(id: string, data: UpdateInspectionTemplateInput): Promise<import("./inspections.types.js").InspectionTemplate | null>;
    getInspections(filters?: Record<string, unknown>): Promise<import("./inspections.types.js").InspectionRecord[]>;
    getInspectionById(id: string): Promise<import("./inspections.types.js").InspectionRecord | null>;
    createInspection(data: CreateInspectionInput): Promise<import("./inspections.types.js").InspectionRecord>;
    updateInspection(id: string, data: UpdateInspectionInput): Promise<import("./inspections.types.js").InspectionRecord>;
    deleteInspection(id: string): Promise<boolean>;
    getOverdueInspections(): Promise<import("./inspections.types.js").InspectionRecord[]>;
    getStats(): Promise<import("./inspections.types.js").InspectionStats>;
}
