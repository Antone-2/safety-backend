import { z } from "zod";
export declare const AiFeatureSchema: z.ZodEnum<["investigation-assistant", "root-cause-analysis", "hazard-detection", "risk-prediction", "chatbot", "compliance-assistant", "training-recommendation", "permit-validation", "inspection-assistant", "safety-observation-analysis", "environmental-monitoring", "predictive-analytics", "dashboard-insights", "document-search", "toolbox-talk-generator", "safety-alert-generator", "trend-analysis", "corrective-action-recommendation", "kpi-forecasting", "executive-reports"]>;
export type AiFeature = z.infer<typeof AiFeatureSchema>;
export declare const ConfidenceLevelSchema: z.ZodEnum<["low", "medium", "high", "very-high"]>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export declare const InvestigationInputSchema: z.ZodObject<{
    incidentId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    evidence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    witnessStatements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    location: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    type?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    evidence?: string[] | undefined;
    incidentId?: string | undefined;
    witnessStatements?: string[] | undefined;
}, {
    description: string;
    type?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    evidence?: string[] | undefined;
    incidentId?: string | undefined;
    witnessStatements?: string[] | undefined;
}>;
export type InvestigationInput = z.infer<typeof InvestigationInputSchema>;
export declare const RootCauseInputSchema: z.ZodObject<{
    investigationId: z.ZodOptional<z.ZodString>;
    incidentId: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    methodology: z.ZodDefault<z.ZodEnum<["5-why", "fishbone", "scat", "fmea", "bow-tie"]>>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    methodology: "5-why" | "fishbone" | "scat" | "fmea" | "bow-tie";
    evidence?: string[] | undefined;
    incidentId?: string | undefined;
    investigationId?: string | undefined;
}, {
    description: string;
    evidence?: string[] | undefined;
    incidentId?: string | undefined;
    investigationId?: string | undefined;
    methodology?: "5-why" | "fishbone" | "scat" | "fmea" | "bow-tie" | undefined;
}>;
export type RootCauseInput = z.infer<typeof RootCauseInputSchema>;
export declare const HazardDetectionInputSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    text?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    imageUrl?: string | undefined;
    context?: Record<string, any> | undefined;
}, {
    text?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    imageUrl?: string | undefined;
    context?: Record<string, any> | undefined;
}>;
export type HazardDetectionInput = z.infer<typeof HazardDetectionInputSchema>;
export declare const RiskPredictionInputSchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    activity: z.ZodOptional<z.ZodString>;
    includeComponents: z.ZodDefault<z.ZodBoolean>;
    horizonDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    includeComponents: boolean;
    horizonDays: number;
    location?: string | undefined;
    department?: string | undefined;
    siteId?: string | undefined;
    activity?: string | undefined;
}, {
    location?: string | undefined;
    department?: string | undefined;
    siteId?: string | undefined;
    activity?: string | undefined;
    includeComponents?: boolean | undefined;
    horizonDays?: number | undefined;
}>;
export type RiskPredictionInput = z.infer<typeof RiskPredictionInputSchema>;
export declare const ChatbotInputSchema: z.ZodObject<{
    query: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    conversationId: z.ZodOptional<z.ZodString>;
    maxResults: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxResults: number;
    query: string;
    context?: Record<string, any> | undefined;
    conversationId?: string | undefined;
}, {
    query: string;
    maxResults?: number | undefined;
    context?: Record<string, any> | undefined;
    conversationId?: string | undefined;
}>;
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;
export declare const AiQueryInputSchema: z.ZodObject<{
    query: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    filters: z.ZodOptional<z.ZodObject<{
        dateFrom: z.ZodOptional<z.ZodString>;
        dateTo: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
        severity: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status?: string | undefined;
        severity?: string | undefined;
        location?: string | undefined;
        department?: string | undefined;
        category?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }, {
        status?: string | undefined;
        severity?: string | undefined;
        location?: string | undefined;
        department?: string | undefined;
        category?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }>>;
    exportFormat: z.ZodDefault<z.ZodEnum<["json", "html"]>>;
    maxSourceRecords: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxSourceRecords: number;
    query: string;
    exportFormat: "html" | "json";
    filters?: {
        status?: string | undefined;
        severity?: string | undefined;
        location?: string | undefined;
        department?: string | undefined;
        category?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    } | undefined;
    conversationId?: string | undefined;
}, {
    query: string;
    filters?: {
        status?: string | undefined;
        severity?: string | undefined;
        location?: string | undefined;
        department?: string | undefined;
        category?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    } | undefined;
    maxSourceRecords?: number | undefined;
    conversationId?: string | undefined;
    exportFormat?: "html" | "json" | undefined;
}>;
export type AiQueryInput = z.infer<typeof AiQueryInputSchema>;
export declare const ComplianceInputSchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    regulation: z.ZodOptional<z.ZodString>;
    auditId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    includeGaps: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    includeGaps: boolean;
    department?: string | undefined;
    siteId?: string | undefined;
    regulation?: string | undefined;
    auditId?: string | undefined;
}, {
    department?: string | undefined;
    siteId?: string | undefined;
    regulation?: string | undefined;
    auditId?: string | undefined;
    includeGaps?: boolean | undefined;
}>;
export type ComplianceInput = z.infer<typeof ComplianceInputSchema>;
export declare const TrainingInputSchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    incidentId: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    role?: string | undefined;
    department?: string | undefined;
    incidentId?: string | undefined;
    employeeId?: string | undefined;
    siteId?: string | undefined;
}, {
    role?: string | undefined;
    department?: string | undefined;
    incidentId?: string | undefined;
    employeeId?: string | undefined;
    limit?: number | undefined;
    siteId?: string | undefined;
}>;
export type TrainingInput = z.infer<typeof TrainingInputSchema>;
export declare const PermitInputSchema: z.ZodObject<{
    permitId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    applicant: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    location?: string | undefined;
    description?: string | undefined;
    applicant?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    permitId?: string | undefined;
}, {
    type?: string | undefined;
    location?: string | undefined;
    description?: string | undefined;
    applicant?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    permitId?: string | undefined;
}>;
export type PermitInput = z.infer<typeof PermitInputSchema>;
export declare const InspectionInputSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    equipmentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    equipmentId?: string | undefined;
    siteId?: string | undefined;
}, {
    type?: string | undefined;
    location?: string | undefined;
    department?: string | undefined;
    equipmentId?: string | undefined;
    siteId?: string | undefined;
}>;
export type InspectionInput = z.infer<typeof InspectionInputSchema>;
export declare const ObservationInputSchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    observer: z.ZodOptional<z.ZodString>;
    activity: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    department?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    siteId?: string | undefined;
    activity?: string | undefined;
    observer?: string | undefined;
}, {
    department?: string | undefined;
    limit?: number | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    siteId?: string | undefined;
    activity?: string | undefined;
    observer?: string | undefined;
}>;
export type ObservationInput = z.infer<typeof ObservationInputSchema>;
export declare const EnvironmentalInputSchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    metric: z.ZodOptional<z.ZodString>;
    sensorType: z.ZodOptional<z.ZodString>;
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
    horizonHours: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    horizonHours: number;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
    sensorType?: string | undefined;
}, {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
    sensorType?: string | undefined;
    horizonHours?: number | undefined;
}>;
export type EnvironmentalInput = z.infer<typeof EnvironmentalInputSchema>;
export declare const PredictiveAnalyticsInputSchema: z.ZodObject<{
    metric: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    horizonMonths: z.ZodDefault<z.ZodNumber>;
    includeConfidence: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    horizonMonths: number;
    includeConfidence: boolean;
    department?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
}, {
    department?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
    horizonMonths?: number | undefined;
    includeConfidence?: boolean | undefined;
}>;
export type PredictiveAnalyticsInput = z.infer<typeof PredictiveAnalyticsInputSchema>;
export declare const TrendAnalysisInputSchema: z.ZodObject<{
    metric: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    periodMonths: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    periodMonths: number;
    department?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
}, {
    department?: string | undefined;
    siteId?: string | undefined;
    metric?: string | undefined;
    periodMonths?: number | undefined;
}>;
export type TrendAnalysisInput = z.infer<typeof TrendAnalysisInputSchema>;
export declare const DocumentSearchInputSchema: z.ZodObject<{
    query: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    maxResults: z.ZodDefault<z.ZodNumber>;
    includeSummary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxResults: number;
    query: string;
    includeSummary: boolean;
    category?: string | undefined;
}, {
    query: string;
    category?: string | undefined;
    maxResults?: number | undefined;
    includeSummary?: boolean | undefined;
}>;
export type DocumentSearchInput = z.infer<typeof DocumentSearchInputSchema>;
export declare const ToolboxTalkInputSchema: z.ZodObject<{
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    topic: z.ZodOptional<z.ZodString>;
    incidentId: z.ZodOptional<z.ZodString>;
    language: z.ZodDefault<z.ZodEnum<["en", "sw"]>>;
}, "strip", z.ZodTypeAny, {
    language: "en" | "sw";
    department?: string | undefined;
    incidentId?: string | undefined;
    siteId?: string | undefined;
    topic?: string | undefined;
}, {
    department?: string | undefined;
    incidentId?: string | undefined;
    siteId?: string | undefined;
    topic?: string | undefined;
    language?: "en" | "sw" | undefined;
}>;
export type ToolboxTalkInput = z.infer<typeof ToolboxTalkInputSchema>;
export declare const SafetyAlertInputSchema: z.ZodObject<{
    triggerEvent: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["notice", "warning", "critical"]>>;
    channels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    severity?: "notice" | "warning" | "critical" | undefined;
    department?: string | undefined;
    siteId?: string | undefined;
    triggerEvent?: string | undefined;
    channels?: string[] | undefined;
}, {
    severity?: "notice" | "warning" | "critical" | undefined;
    department?: string | undefined;
    siteId?: string | undefined;
    triggerEvent?: string | undefined;
    channels?: string[] | undefined;
}>;
export type SafetyAlertInput = z.infer<typeof SafetyAlertInputSchema>;
export declare const CorrectiveActionInputSchema: z.ZodObject<{
    capaId: z.ZodOptional<z.ZodString>;
    rootCause: z.ZodOptional<z.ZodString>;
    incidentId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    capaId?: string | undefined;
    department?: string | undefined;
    rootCause?: string | undefined;
    incidentId?: string | undefined;
}, {
    capaId?: string | undefined;
    department?: string | undefined;
    rootCause?: string | undefined;
    incidentId?: string | undefined;
    limit?: number | undefined;
}>;
export type CorrectiveActionInput = z.infer<typeof CorrectiveActionInputSchema>;
export declare const KpiForecastInputSchema: z.ZodObject<{
    kpi: z.ZodString;
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    horizonMonths: z.ZodDefault<z.ZodNumber>;
    scenario: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    horizonMonths: number;
    kpi: string;
    department?: string | undefined;
    siteId?: string | undefined;
    scenario?: string | undefined;
}, {
    kpi: string;
    department?: string | undefined;
    siteId?: string | undefined;
    horizonMonths?: number | undefined;
    scenario?: string | undefined;
}>;
export type KpiForecastInput = z.infer<typeof KpiForecastInputSchema>;
export declare const ExecutiveReportInputSchema: z.ZodObject<{
    reportType: z.ZodDefault<z.ZodEnum<["monthly", "quarterly", "annual", "adhoc"]>>;
    siteId: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    includeBenchmark: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<["json", "markdown", "pdf"]>>;
}, "strip", z.ZodTypeAny, {
    format: "pdf" | "json" | "markdown";
    reportType: "monthly" | "quarterly" | "annual" | "adhoc";
    includeBenchmark: boolean;
    department?: string | undefined;
    siteId?: string | undefined;
}, {
    department?: string | undefined;
    format?: "pdf" | "json" | "markdown" | undefined;
    siteId?: string | undefined;
    reportType?: "monthly" | "quarterly" | "annual" | "adhoc" | undefined;
    includeBenchmark?: boolean | undefined;
}>;
export type ExecutiveReportInput = z.infer<typeof ExecutiveReportInputSchema>;
export declare const AiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodAny;
    metadata: z.ZodObject<{
        feature: z.ZodString;
        confidence: z.ZodOptional<z.ZodNumber>;
        confidenceLevel: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "very-high"]>>;
        modelVersion: z.ZodOptional<z.ZodString>;
        processingTimeMs: z.ZodOptional<z.ZodNumber>;
        sources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        feature: string;
        confidence?: number | undefined;
        confidenceLevel?: "high" | "low" | "medium" | "very-high" | undefined;
        modelVersion?: string | undefined;
        processingTimeMs?: number | undefined;
        sources?: string[] | undefined;
        warnings?: string[] | undefined;
    }, {
        feature: string;
        confidence?: number | undefined;
        confidenceLevel?: "high" | "low" | "medium" | "very-high" | undefined;
        modelVersion?: string | undefined;
        processingTimeMs?: number | undefined;
        sources?: string[] | undefined;
        warnings?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        feature: string;
        confidence?: number | undefined;
        confidenceLevel?: "high" | "low" | "medium" | "very-high" | undefined;
        modelVersion?: string | undefined;
        processingTimeMs?: number | undefined;
        sources?: string[] | undefined;
        warnings?: string[] | undefined;
    };
    success: boolean;
    data?: any;
}, {
    metadata: {
        feature: string;
        confidence?: number | undefined;
        confidenceLevel?: "high" | "low" | "medium" | "very-high" | undefined;
        modelVersion?: string | undefined;
        processingTimeMs?: number | undefined;
        sources?: string[] | undefined;
        warnings?: string[] | undefined;
    };
    success: boolean;
    data?: any;
}>;
export type AiResponse<T = any> = {
    success: boolean;
    data: T;
    metadata: {
        feature: string;
        confidence?: number;
        confidenceLevel?: ConfidenceLevel;
        modelVersion?: string;
        processingTimeMs?: number;
        sources?: string[];
        warnings?: string[];
    };
};
export declare const AiFeedbackSchema: z.ZodObject<{
    feature: z.ZodEnum<["investigation-assistant", "root-cause-analysis", "hazard-detection", "risk-prediction", "chatbot", "compliance-assistant", "training-recommendation", "permit-validation", "inspection-assistant", "safety-observation-analysis", "environmental-monitoring", "predictive-analytics", "dashboard-insights", "document-search", "toolbox-talk-generator", "safety-alert-generator", "trend-analysis", "corrective-action-recommendation", "kpi-forecasting", "executive-reports"]>;
    predictionId: z.ZodOptional<z.ZodString>;
    rating: z.ZodNumber;
    feedbackText: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    feature: "investigation-assistant" | "root-cause-analysis" | "hazard-detection" | "risk-prediction" | "chatbot" | "compliance-assistant" | "training-recommendation" | "permit-validation" | "inspection-assistant" | "safety-observation-analysis" | "environmental-monitoring" | "predictive-analytics" | "dashboard-insights" | "document-search" | "toolbox-talk-generator" | "safety-alert-generator" | "trend-analysis" | "corrective-action-recommendation" | "kpi-forecasting" | "executive-reports";
    rating: number;
    predictionId?: string | undefined;
    feedbackText?: string | undefined;
}, {
    feature: "investigation-assistant" | "root-cause-analysis" | "hazard-detection" | "risk-prediction" | "chatbot" | "compliance-assistant" | "training-recommendation" | "permit-validation" | "inspection-assistant" | "safety-observation-analysis" | "environmental-monitoring" | "predictive-analytics" | "dashboard-insights" | "document-search" | "toolbox-talk-generator" | "safety-alert-generator" | "trend-analysis" | "corrective-action-recommendation" | "kpi-forecasting" | "executive-reports";
    rating: number;
    predictionId?: string | undefined;
    feedbackText?: string | undefined;
}>;
export type AiFeedback = z.infer<typeof AiFeedbackSchema>;
export declare const InvestigationAssistantResponseSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodString>;
    timeline: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        event: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        event: string;
        timestamp: string;
    }, {
        source: string;
        event: string;
        timestamp: string;
    }>, "many">;
    entities: z.ZodObject<{
        who: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        what: z.ZodOptional<z.ZodString>;
        where: z.ZodOptional<z.ZodString>;
        when: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        who?: string[] | undefined;
        what?: string | undefined;
        where?: string | undefined;
        when?: string | undefined;
    }, {
        who?: string[] | undefined;
        what?: string | undefined;
        where?: string | undefined;
        when?: string | undefined;
    }>;
    suggestedQuestions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    relatedIncidents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    timeline: {
        source: string;
        event: string;
        timestamp: string;
    }[];
    entities: {
        who?: string[] | undefined;
        what?: string | undefined;
        where?: string | undefined;
        when?: string | undefined;
    };
    severity?: string | undefined;
    category?: string | undefined;
    suggestedQuestions?: string[] | undefined;
    relatedIncidents?: string[] | undefined;
}, {
    timeline: {
        source: string;
        event: string;
        timestamp: string;
    }[];
    entities: {
        who?: string[] | undefined;
        what?: string | undefined;
        where?: string | undefined;
        when?: string | undefined;
    };
    severity?: string | undefined;
    category?: string | undefined;
    suggestedQuestions?: string[] | undefined;
    relatedIncidents?: string[] | undefined;
}>;
export declare const RootCauseAnalysisResponseSchema: z.ZodObject<{
    methodology: z.ZodString;
    causalChain: z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        cause: z.ZodString;
        evidence: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        level: number;
        evidence: string;
        cause: string;
    }, {
        level: number;
        evidence: string;
        cause: string;
    }>, "many">;
    fishboneCategories: z.ZodOptional<z.ZodArray<z.ZodObject<{
        category: z.ZodString;
        causes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        category: string;
        causes: string[];
    }, {
        category: string;
        causes: string[];
    }>, "many">>;
    confidence: z.ZodNumber;
    alternativeCauses: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    barrierGaps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    methodology: string;
    causalChain: {
        level: number;
        evidence: string;
        cause: string;
    }[];
    fishboneCategories?: {
        category: string;
        causes: string[];
    }[] | undefined;
    alternativeCauses?: string[] | undefined;
    barrierGaps?: string[] | undefined;
}, {
    confidence: number;
    methodology: string;
    causalChain: {
        level: number;
        evidence: string;
        cause: string;
    }[];
    fishboneCategories?: {
        category: string;
        causes: string[];
    }[] | undefined;
    alternativeCauses?: string[] | undefined;
    barrierGaps?: string[] | undefined;
}>;
export declare const HazardDetectionOutputSchema: z.ZodObject<{
    hazards: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        severity: z.ZodString;
        confidence: z.ZodNumber;
        recommendedControl: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        severity: string;
        confidence: number;
        recommendedControl: string;
    }, {
        type: string;
        severity: string;
        confidence: number;
        recommendedControl: string;
    }>, "many">;
    summary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hazards: {
        type: string;
        severity: string;
        confidence: number;
        recommendedControl: string;
    }[];
    summary?: string | undefined;
}, {
    hazards: {
        type: string;
        severity: string;
        confidence: number;
        recommendedControl: string;
    }[];
    summary?: string | undefined;
}>;
export declare const RiskScoreOutputSchema: z.ZodObject<{
    riskScore: z.ZodNumber;
    riskLevel: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    components: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    trend: z.ZodOptional<z.ZodEnum<["improving", "stable", "deteriorating"]>>;
    explanation: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    riskScore: number;
    riskLevel: "Critical" | "Low" | "Medium" | "High";
    components?: Record<string, number> | undefined;
    trend?: "improving" | "stable" | "deteriorating" | undefined;
    explanation?: string[] | undefined;
}, {
    riskScore: number;
    riskLevel: "Critical" | "Low" | "Medium" | "High";
    components?: Record<string, number> | undefined;
    trend?: "improving" | "stable" | "deteriorating" | undefined;
    explanation?: string[] | undefined;
}>;
export declare const ChatbotResponseSchema: z.ZodObject<{
    answer: z.ZodString;
    sources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        excerpt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        excerpt: string;
    }, {
        title: string;
        excerpt: string;
    }>, "many">>;
    suggestedActions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    answer: string;
    sources?: {
        title: string;
        excerpt: string;
    }[] | undefined;
    suggestedActions?: string[] | undefined;
}, {
    answer: string;
    sources?: {
        title: string;
        excerpt: string;
    }[] | undefined;
    suggestedActions?: string[] | undefined;
}>;
export declare const ComplianceGapSchema: z.ZodObject<{
    obligationId: z.ZodOptional<z.ZodString>;
    requirement: z.ZodString;
    status: z.ZodEnum<["Compliant", "Non-compliant", "Partially Compliant"]>;
    gapDescription: z.ZodOptional<z.ZodString>;
    evidence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    owner: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>;
}, "strip", z.ZodTypeAny, {
    status: "Compliant" | "Non-compliant" | "Partially Compliant";
    requirement: string;
    dueDate?: string | undefined;
    severity?: "Critical" | "Low" | "Medium" | "High" | undefined;
    owner?: string | undefined;
    evidence?: string[] | undefined;
    obligationId?: string | undefined;
    gapDescription?: string | undefined;
}, {
    status: "Compliant" | "Non-compliant" | "Partially Compliant";
    requirement: string;
    dueDate?: string | undefined;
    severity?: "Critical" | "Low" | "Medium" | "High" | undefined;
    owner?: string | undefined;
    evidence?: string[] | undefined;
    obligationId?: string | undefined;
    gapDescription?: string | undefined;
}>;
export declare const TrainingRecommendationSchema: z.ZodObject<{
    courseId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    priority: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    reason: z.ZodString;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
    estimatedDurationHours: z.ZodOptional<z.ZodNumber>;
    modality: z.ZodOptional<z.ZodEnum<["classroom", "e-learning", "vr", "on-the-job"]>>;
}, "strip", z.ZodTypeAny, {
    priority: "Critical" | "Low" | "Medium" | "High";
    reason: string;
    title: string;
    courseId?: string | undefined;
    estimatedCost?: number | undefined;
    estimatedDurationHours?: number | undefined;
    modality?: "classroom" | "e-learning" | "vr" | "on-the-job" | undefined;
}, {
    priority: "Critical" | "Low" | "Medium" | "High";
    reason: string;
    title: string;
    courseId?: string | undefined;
    estimatedCost?: number | undefined;
    estimatedDurationHours?: number | undefined;
    modality?: "classroom" | "e-learning" | "vr" | "on-the-job" | undefined;
}>;
export declare const InspectionChecklistSchema: z.ZodObject<{
    sections: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            question: z.ZodString;
            reference: z.ZodOptional<z.ZodString>;
            critical: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }, {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        items: {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }[];
    }, {
        title: string;
        items: {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }[];
    }>, "many">;
    estimatedDurationMinutes: z.ZodNumber;
    regulatoryReferences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    sections: {
        title: string;
        items: {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }[];
    }[];
    estimatedDurationMinutes: number;
    regulatoryReferences?: string[] | undefined;
}, {
    sections: {
        title: string;
        items: {
            question: string;
            critical?: boolean | undefined;
            reference?: string | undefined;
        }[];
    }[];
    estimatedDurationMinutes: number;
    regulatoryReferences?: string[] | undefined;
}>;
export declare const ObservationInsightSchema: z.ZodObject<{
    patternType: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    shift: z.ZodOptional<z.ZodString>;
    frequency: z.ZodNumber;
    recommendation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    frequency: number;
    patternType: string;
    recommendation: string;
    shift?: string | undefined;
    location?: string | undefined;
}, {
    frequency: number;
    patternType: string;
    recommendation: string;
    shift?: string | undefined;
    location?: string | undefined;
}>;
export declare const AlertOutputSchema: z.ZodObject<{
    grade: z.ZodEnum<["notice", "warning", "critical"]>;
    headline: z.ZodString;
    summary: z.ZodString;
    actions: z.ZodArray<z.ZodString, "many">;
    recipients: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    actions: string[];
    grade: "notice" | "warning" | "critical";
    headline: string;
    recipients?: string[] | undefined;
}, {
    summary: string;
    actions: string[];
    grade: "notice" | "warning" | "critical";
    headline: string;
    recipients?: string[] | undefined;
}>;
export declare const TrendAnalysisOutputSchema: z.ZodObject<{
    metric: z.ZodString;
    trend: z.ZodEnum<["increasing", "decreasing", "stable", "volatile"]>;
    changePercent: z.ZodNumber;
    statisticalSignificant: z.ZodBoolean;
    seasonalityDetected: z.ZodBoolean;
    changePoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        direction: z.ZodString;
        pValue: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        direction: string;
        pValue?: number | undefined;
    }, {
        date: string;
        direction: string;
        pValue?: number | undefined;
    }>, "many">>;
    insight: z.ZodString;
}, "strip", z.ZodTypeAny, {
    metric: string;
    trend: "stable" | "increasing" | "decreasing" | "volatile";
    changePercent: number;
    statisticalSignificant: boolean;
    seasonalityDetected: boolean;
    insight: string;
    changePoints?: {
        date: string;
        direction: string;
        pValue?: number | undefined;
    }[] | undefined;
}, {
    metric: string;
    trend: "stable" | "increasing" | "decreasing" | "volatile";
    changePercent: number;
    statisticalSignificant: boolean;
    seasonalityDetected: boolean;
    insight: string;
    changePoints?: {
        date: string;
        direction: string;
        pValue?: number | undefined;
    }[] | undefined;
}>;
export declare const CorrectiveActionOutputSchema: z.ZodObject<{
    actions: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        rationale: z.ZodString;
        estimatedEffectiveness: z.ZodNumber;
        implementationDays: z.ZodOptional<z.ZodNumber>;
        costEstimate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        rationale: string;
        estimatedEffectiveness: number;
        costEstimate?: string | undefined;
        implementationDays?: number | undefined;
    }, {
        title: string;
        rationale: string;
        estimatedEffectiveness: number;
        costEstimate?: string | undefined;
        implementationDays?: number | undefined;
    }>, "many">;
    sequencing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    actions: {
        title: string;
        rationale: string;
        estimatedEffectiveness: number;
        costEstimate?: string | undefined;
        implementationDays?: number | undefined;
    }[];
    sequencing?: string[] | undefined;
}, {
    actions: {
        title: string;
        rationale: string;
        estimatedEffectiveness: number;
        costEstimate?: string | undefined;
        implementationDays?: number | undefined;
    }[];
    sequencing?: string[] | undefined;
}>;
export declare const KpiForecastOutputSchema: z.ZodObject<{
    kpi: z.ZodString;
    values: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        forecast: z.ZodNumber;
        lower: z.ZodOptional<z.ZodNumber>;
        upper: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        month: string;
        forecast: number;
        lower?: number | undefined;
        upper?: number | undefined;
    }, {
        month: string;
        forecast: number;
        lower?: number | undefined;
        upper?: number | undefined;
    }>, "many">;
    drivers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scenarioImpacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        scenario: z.ZodString;
        impact: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        scenario: string;
        impact: number;
    }, {
        scenario: string;
        impact: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    values: {
        month: string;
        forecast: number;
        lower?: number | undefined;
        upper?: number | undefined;
    }[];
    kpi: string;
    drivers?: string[] | undefined;
    scenarioImpacts?: {
        scenario: string;
        impact: number;
    }[] | undefined;
}, {
    values: {
        month: string;
        forecast: number;
        lower?: number | undefined;
        upper?: number | undefined;
    }[];
    kpi: string;
    drivers?: string[] | undefined;
    scenarioImpacts?: {
        scenario: string;
        impact: number;
    }[] | undefined;
}>;
export declare const ExecutiveReportOutputSchema: z.ZodObject<{
    title: z.ZodString;
    period: z.ZodString;
    executiveSummary: z.ZodString;
    kpiScorecard: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        target: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string | number;
        name: string;
        status?: string | undefined;
        target?: string | number | undefined;
    }, {
        value: string | number;
        name: string;
        status?: string | undefined;
        target?: string | number | undefined;
    }>, "many">;
    topRisks: z.ZodArray<z.ZodObject<{
        risk: z.ZodString;
        status: z.ZodString;
        mitigation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        risk: string;
        mitigation: string;
    }, {
        status: string;
        risk: string;
        mitigation: string;
    }>, "many">;
    complianceStatus: z.ZodString;
    recommendations: z.ZodArray<z.ZodString, "many">;
    nextReviewDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    recommendations: string[];
    period: string;
    executiveSummary: string;
    kpiScorecard: {
        value: string | number;
        name: string;
        status?: string | undefined;
        target?: string | number | undefined;
    }[];
    topRisks: {
        status: string;
        risk: string;
        mitigation: string;
    }[];
    complianceStatus: string;
    nextReviewDate?: string | undefined;
}, {
    title: string;
    recommendations: string[];
    period: string;
    executiveSummary: string;
    kpiScorecard: {
        value: string | number;
        name: string;
        status?: string | undefined;
        target?: string | number | undefined;
    }[];
    topRisks: {
        status: string;
        risk: string;
        mitigation: string;
    }[];
    complianceStatus: string;
    nextReviewDate?: string | undefined;
}>;
