import type { AiQueryInput } from "../ai.types.js";
export type Json = Record<string, unknown>;
export type AiActor = {
    id?: string;
    email?: string;
    role?: string;
    name?: string;
};
export type AiGuardrailSettings = {
    enabled?: boolean;
    allowedRoles?: string[];
    requireCitations?: boolean;
    requireCitation?: boolean;
    allowExports?: boolean;
    maxSourceRecords?: number;
    ragSources?: string[];
};
export type AiQueryDomain = "reports" | "training" | "capa" | "permits";
export type NonReportAiQueryDomain = Exclude<AiQueryDomain, "reports">;
export type AuditInput = {
    feature: string;
    prompt: string;
    output: any;
    confidence: number;
    user?: AiActor;
    denied?: boolean;
    denialReason?: string;
};
export type BaseQueryExecutionInput = {
    governedInput: AiQueryInput;
    user?: AiActor;
    role: string;
    settings: AiGuardrailSettings;
    startedAt: number;
    prompt: string;
};
export type QueryEngineDeps = {
    llm: {
        generate: (systemPrompt: string, userPrompt: string, options?: {
            temperature?: number;
            maxTokens?: number;
        }) => Promise<string>;
    };
    model: string;
    savePrediction: (feature: string, input: unknown, output: unknown, confidence: number, userId?: string) => Promise<void>;
    savePromptAudit: (input: AuditInput) => Promise<void>;
};
export type DomainQueryHandler = {
    domain: NonReportAiQueryDomain;
    execute(input: BaseQueryExecutionInput): Promise<Json>;
};
