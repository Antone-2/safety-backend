import { z } from "zod";
export const AiFeatureSchema = z.enum([
    "investigation-assistant",
    "root-cause-analysis",
    "hazard-detection",
    "risk-prediction",
    "chatbot",
    "compliance-assistant",
    "training-recommendation",
    "permit-validation",
    "inspection-assistant",
    "safety-observation-analysis",
    "environmental-monitoring",
    "predictive-analytics",
    "dashboard-insights",
    "document-search",
    "toolbox-talk-generator",
    "safety-alert-generator",
    "trend-analysis",
    "corrective-action-recommendation",
    "kpi-forecasting",
    "executive-reports",
]);
export const ConfidenceLevelSchema = z.enum(["low", "medium", "high", "very-high"]);
export const InvestigationInputSchema = z.object({
    incidentId: z.string().optional(),
    type: z.string().optional(),
    description: z.string().min(1),
    evidence: z.array(z.string()).optional(),
    witnessStatements: z.array(z.string()).optional(),
    location: z.string().optional(),
    department: z.string().optional(),
});
export const RootCauseInputSchema = z.object({
    investigationId: z.string().optional(),
    incidentId: z.string().optional(),
    description: z.string().min(1),
    methodology: z.enum(["5-why", "fishbone", "scat", "fmea", "bow-tie"]).default("5-why"),
    evidence: z.array(z.string()).optional(),
});
export const HazardDetectionInputSchema = z.object({
    text: z.string().optional(),
    imageUrl: z.string().optional(),
    location: z.string().optional(),
    department: z.string().optional(),
    context: z.record(z.string(), z.any()).optional(),
});
export const RiskPredictionInputSchema = z.object({
    siteId: z.string().optional(),
    location: z.string().optional(),
    department: z.string().optional(),
    activity: z.string().optional(),
    includeComponents: z.boolean().default(true),
    horizonDays: z.number().min(1).max(365).default(30),
});
export const ChatbotInputSchema = z.object({
    query: z.string().min(1),
    context: z.record(z.string(), z.any()).optional(),
    conversationId: z.string().optional(),
    maxResults: z.number().min(1).max(20).default(5),
});
export const AiQueryInputSchema = z.object({
    query: z.string().min(1),
    conversationId: z.string().optional(),
    filters: z
        .object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        location: z.string().optional(),
        department: z.string().optional(),
        severity: z.string().optional(),
        status: z.string().optional(),
        category: z.string().optional(),
    })
        .optional(),
    exportFormat: z.enum(["json", "html"]).default("json"),
    maxSourceRecords: z.number().min(5).max(200).default(50),
});
export const ComplianceInputSchema = z.object({
    siteId: z.string().optional(),
    regulation: z.string().optional(),
    auditId: z.string().optional(),
    department: z.string().optional(),
    includeGaps: z.boolean().default(true),
});
export const TrainingInputSchema = z.object({
    employeeId: z.string().optional(),
    department: z.string().optional(),
    role: z.string().optional(),
    siteId: z.string().optional(),
    incidentId: z.string().optional(),
    limit: z.number().min(1).max(50).default(10),
});
export const PermitInputSchema = z.object({
    permitId: z.string().optional(),
    type: z.string().optional(),
    location: z.string().optional(),
    applicant: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});
export const InspectionInputSchema = z.object({
    type: z.string().optional(),
    siteId: z.string().optional(),
    location: z.string().optional(),
    department: z.string().optional(),
    equipmentId: z.string().optional(),
});
export const ObservationInputSchema = z.object({
    siteId: z.string().optional(),
    department: z.string().optional(),
    observer: z.string().optional(),
    activity: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().min(1).max(200).default(50),
});
export const EnvironmentalInputSchema = z.object({
    siteId: z.string().optional(),
    metric: z.string().optional(),
    sensorType: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    horizonHours: z.number().min(1).max(720).default(24),
});
export const PredictiveAnalyticsInputSchema = z.object({
    metric: z.string().optional(),
    siteId: z.string().optional(),
    department: z.string().optional(),
    horizonMonths: z.number().min(1).max(36).default(6),
    includeConfidence: z.boolean().default(true),
});
export const TrendAnalysisInputSchema = z.object({
    metric: z.string().optional(),
    siteId: z.string().optional(),
    department: z.string().optional(),
    periodMonths: z.number().min(1).max(120).default(12),
});
export const DocumentSearchInputSchema = z.object({
    query: z.string().min(1),
    category: z.string().optional(),
    maxResults: z.number().min(1).max(50).default(10),
    includeSummary: z.boolean().default(true),
});
export const ToolboxTalkInputSchema = z.object({
    siteId: z.string().optional(),
    department: z.string().optional(),
    topic: z.string().optional(),
    incidentId: z.string().optional(),
    language: z.enum(["en", "sw"]).default("en"),
});
export const SafetyAlertInputSchema = z.object({
    triggerEvent: z.string().optional(),
    siteId: z.string().optional(),
    department: z.string().optional(),
    severity: z.enum(["notice", "warning", "critical"]).optional(),
    channels: z.array(z.string()).optional(),
});
export const CorrectiveActionInputSchema = z.object({
    capaId: z.string().optional(),
    rootCause: z.string().optional(),
    incidentId: z.string().optional(),
    department: z.string().optional(),
    limit: z.number().min(1).max(20).default(5),
});
export const KpiForecastInputSchema = z.object({
    kpi: z.string().min(1),
    siteId: z.string().optional(),
    department: z.string().optional(),
    horizonMonths: z.number().min(1).max(24).default(6),
    scenario: z.string().optional(),
});
export const ExecutiveReportInputSchema = z.object({
    reportType: z.enum(["monthly", "quarterly", "annual", "adhoc"]).default("monthly"),
    siteId: z.string().optional(),
    department: z.string().optional(),
    includeBenchmark: z.boolean().default(true),
    format: z.enum(["json", "markdown", "pdf"]).default("json"),
});
export const AiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any(),
    metadata: z.object({
        feature: z.string(),
        confidence: z.number().min(0).max(1).optional(),
        confidenceLevel: ConfidenceLevelSchema.optional(),
        modelVersion: z.string().optional(),
        processingTimeMs: z.number().optional(),
        sources: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
    }),
});
export const AiFeedbackSchema = z.object({
    feature: AiFeatureSchema,
    predictionId: z.string().optional(),
    rating: z.number().min(1).max(5),
    feedbackText: z.string().optional(),
});
export const InvestigationAssistantResponseSchema = z.object({
    category: z.string().optional(),
    severity: z.string().optional(),
    timeline: z.array(z.object({ timestamp: z.string(), event: z.string(), source: z.string() })),
    entities: z.object({
        who: z.array(z.string()).optional(),
        what: z.string().optional(),
        where: z.string().optional(),
        when: z.string().optional(),
    }),
    suggestedQuestions: z.array(z.string()).optional(),
    relatedIncidents: z.array(z.string()).optional(),
});
export const RootCauseAnalysisResponseSchema = z.object({
    methodology: z.string(),
    causalChain: z.array(z.object({ level: z.number(), cause: z.string(), evidence: z.string() })),
    fishboneCategories: z.array(z.object({ category: z.string(), causes: z.array(z.string()) })).optional(),
    confidence: z.number().min(0).max(1),
    alternativeCauses: z.array(z.string()).optional(),
    barrierGaps: z.array(z.string()).optional(),
});
export const HazardDetectionOutputSchema = z.object({
    hazards: z.array(z.object({ type: z.string(), severity: z.string(), confidence: z.number(), recommendedControl: z.string() })),
    summary: z.string().optional(),
});
export const RiskScoreOutputSchema = z.object({
    riskScore: z.number().min(0).max(100),
    riskLevel: z.enum(["Low", "Medium", "High", "Critical"]),
    components: z.record(z.string(), z.number()).optional(),
    trend: z.enum(["improving", "stable", "deteriorating"]).optional(),
    explanation: z.array(z.string()).optional(),
});
export const ChatbotResponseSchema = z.object({
    answer: z.string(),
    sources: z.array(z.object({ title: z.string(), excerpt: z.string() })).optional(),
    suggestedActions: z.array(z.string()).optional(),
});
export const ComplianceGapSchema = z.object({
    obligationId: z.string().optional(),
    requirement: z.string(),
    status: z.enum(["Compliant", "Non-compliant", "Partially Compliant"]),
    gapDescription: z.string().optional(),
    evidence: z.array(z.string()).optional(),
    owner: z.string().optional(),
    dueDate: z.string().optional(),
    severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
});
export const TrainingRecommendationSchema = z.object({
    courseId: z.string().optional(),
    title: z.string(),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    reason: z.string(),
    estimatedCost: z.number().optional(),
    estimatedDurationHours: z.number().optional(),
    modality: z.enum(["classroom", "e-learning", "vr", "on-the-job"]).optional(),
});
export const InspectionChecklistSchema = z.object({
    sections: z.array(z.object({ title: z.string(), items: z.array(z.object({ question: z.string(), reference: z.string().optional(), critical: z.boolean().optional() })) })),
    estimatedDurationMinutes: z.number(),
    regulatoryReferences: z.array(z.string()).optional(),
});
export const ObservationInsightSchema = z.object({
    patternType: z.string(),
    location: z.string().optional(),
    shift: z.string().optional(),
    frequency: z.number(),
    recommendation: z.string(),
});
export const AlertOutputSchema = z.object({
    grade: z.enum(["notice", "warning", "critical"]),
    headline: z.string(),
    summary: z.string(),
    actions: z.array(z.string()),
    recipients: z.array(z.string()).optional(),
});
export const TrendAnalysisOutputSchema = z.object({
    metric: z.string(),
    trend: z.enum(["increasing", "decreasing", "stable", "volatile"]),
    changePercent: z.number(),
    statisticalSignificant: z.boolean(),
    seasonalityDetected: z.boolean(),
    changePoints: z.array(z.object({ date: z.string(), direction: z.string(), pValue: z.number().optional() })).optional(),
    insight: z.string(),
});
export const CorrectiveActionOutputSchema = z.object({
    actions: z.array(z.object({ title: z.string(), rationale: z.string(), estimatedEffectiveness: z.number(), implementationDays: z.number().optional(), costEstimate: z.string().optional() })),
    sequencing: z.array(z.string()).optional(),
});
export const KpiForecastOutputSchema = z.object({
    kpi: z.string(),
    values: z.array(z.object({ month: z.string(), forecast: z.number(), lower: z.number().optional(), upper: z.number().optional() })),
    drivers: z.array(z.string()).optional(),
    scenarioImpacts: z.array(z.object({ scenario: z.string(), impact: z.number() })).optional(),
});
export const ExecutiveReportOutputSchema = z.object({
    title: z.string(),
    period: z.string(),
    executiveSummary: z.string(),
    kpiScorecard: z.array(z.object({ name: z.string(), value: z.union([z.string(), z.number()]), target: z.union([z.string(), z.number()]).optional(), status: z.string().optional() })),
    topRisks: z.array(z.object({ risk: z.string(), status: z.string(), mitigation: z.string() })),
    complianceStatus: z.string(),
    recommendations: z.array(z.string()),
    nextReviewDate: z.string().optional(),
});
