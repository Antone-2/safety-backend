import { Router, } from "express";
import { AiService } from "./ai.service.js";
import { authenticateUser, requireRole, } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import * as schemas from "./ai.types.js";
export function createAiController(service) {
    return {
        async investigationAssistant(req, res) {
            const data = req.body;
            const result = await service.investigationAssistant(data, req.user?.id);
            res.json(result);
        },
        async rootCauseAnalysis(req, res) {
            const data = req.body;
            const result = await service.rootCauseAnalysis(data, req.user?.id);
            res.json(result);
        },
        async hazardDetection(req, res) {
            const data = req.body;
            const result = await service.hazardDetection(data, req.user?.id);
            res.json(result);
        },
        async riskPrediction(req, res) {
            const data = req.body;
            const result = await service.riskPrediction(data, req.user?.id);
            res.json(result);
        },
        async chatbot(req, res) {
            const data = req.body;
            const result = await service.chatbot(data, req.user?.id);
            res.json(result);
        },
        async query(req, res) {
            const data = req.body;
            const result = await service.query(data, req.user);
            res.json(result);
        },
        async complianceAssistant(req, res) {
            const data = req.body;
            const result = await service.complianceAssistant(data, req.user?.id);
            res.json(result);
        },
        async trainingRecommendation(req, res) {
            const data = req.body;
            const result = await service.trainingRecommendation(data, req.user?.id);
            res.json(result);
        },
        async permitValidation(req, res) {
            const data = req.body;
            const result = await service.permitValidation(data, req.user?.id);
            res.json(result);
        },
        async inspectionAssistant(req, res) {
            const data = req.body;
            const result = await service.inspectionAssistant(data, req.user?.id);
            res.json(result);
        },
        async safetyObservationAnalysis(req, res) {
            const data = req.body;
            const result = await service.safetyObservationAnalysis(data, req.user?.id);
            res.json(result);
        },
        async environmentalMonitoring(req, res) {
            const data = req.body;
            const result = await service.environmentalMonitoring(data, req.user?.id);
            res.json(result);
        },
        async predictiveAnalytics(req, res) {
            const data = req.body;
            const result = await service.predictiveAnalytics(data, req.user?.id);
            res.json(result);
        },
        async dashboardInsights(req, res) {
            const data = req.body;
            const result = await service.dashboardInsights(data, req.user?.id);
            res.json(result);
        },
        async documentSearch(req, res) {
            const data = req.body;
            const result = await service.documentSearch(data, req.user?.id);
            res.json(result);
        },
        async toolboxTalkGenerator(req, res) {
            const data = req.body;
            const result = await service.toolboxTalkGenerator(data, req.user?.id);
            res.json(result);
        },
        async safetyAlertGenerator(req, res) {
            const data = req.body;
            const result = await service.safetyAlertGenerator(data, req.user?.id);
            res.json(result);
        },
        async trendAnalysis(req, res) {
            const data = req.body;
            const result = await service.trendAnalysis(data, req.user?.id);
            res.json(result);
        },
        async correctiveActionRecommendation(req, res) {
            const data = req.body;
            const result = await service.correctiveActionRecommendation(data, req.user?.id);
            res.json(result);
        },
        async kpiForecasting(req, res) {
            const data = req.body;
            const result = await service.kpiForecasting(data, req.user?.id);
            res.json(result);
        },
        async executiveReports(req, res) {
            const data = req.body;
            const result = await service.executiveReports(data, req.user?.id);
            res.json(result);
        },
        async submitFeedback(req, res) {
            const data = req.body;
            const repository = service
                .repository;
            const feedback = await repository.saveFeedback({
                feature: data.feature,
                predictionId: data.predictionId,
                userId: req.user?.id || "",
                rating: data.rating,
                feedbackText: data.feedbackText,
            });
            res.status(201).json({ success: true, data: { id: feedback } });
        },
        async getGuardrailSettings(req, res) {
            const repository = service.getRepository();
            const settings = await repository.getGuardrailSettings();
            res.json({ success: true, data: settings });
        },
        async updateGuardrailSettings(req, res) {
            const repository = service.getRepository();
            const settings = await repository.updateGuardrailSettings(req.body, req.user?.email || req.user?.name);
            res.json({ success: true, data: settings });
        },
        async listPromptAudit(req, res) {
            const repository = service.getRepository();
            const audit = await repository.listPromptAudit({
                feature: typeof req.query.feature === "string" ? req.query.feature : undefined,
                userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
                limit: typeof req.query.limit === "string" ? Number(req.query.limit) : 100,
            });
            res.json({ success: true, data: audit });
        },
    };
}
export function createAiRouter() {
    const service = new AiService();
    const controller = createAiController(service);
    const router = Router();
    router.use(authenticateUser);
    router.post("/investigation-assistant", validate(schemas.InvestigationInputSchema), controller.investigationAssistant);
    router.post("/root-cause-analysis", validate(schemas.RootCauseInputSchema), controller.rootCauseAnalysis);
    router.post("/hazard-detection", validate(schemas.HazardDetectionInputSchema), controller.hazardDetection);
    router.post("/risk-prediction", validate(schemas.RiskPredictionInputSchema), controller.riskPrediction);
    router.post("/query", validate(schemas.AiQueryInputSchema), controller.query);
    router.post("/chatbot/chat", validate(schemas.ChatbotInputSchema), controller.chatbot);
    router.post("/compliance-assistant", validate(schemas.ComplianceInputSchema), controller.complianceAssistant);
    router.post("/training-recommendation", validate(schemas.TrainingInputSchema), controller.trainingRecommendation);
    router.post("/permit-validation", validate(schemas.PermitInputSchema), controller.permitValidation);
    router.post("/inspection-assistant", validate(schemas.InspectionInputSchema), controller.inspectionAssistant);
    router.post("/safety-observation-analysis", validate(schemas.ObservationInputSchema), controller.safetyObservationAnalysis);
    router.post("/environmental-monitoring", validate(schemas.EnvironmentalInputSchema), controller.environmentalMonitoring);
    router.post("/predictive-analytics", validate(schemas.PredictiveAnalyticsInputSchema), controller.predictiveAnalytics);
    router.post("/dashboard-insights", validate(schemas.PredictiveAnalyticsInputSchema), controller.dashboardInsights);
    router.post("/document-search", validate(schemas.DocumentSearchInputSchema), controller.documentSearch);
    router.post("/toolbox-talk-generator", validate(schemas.ToolboxTalkInputSchema), controller.toolboxTalkGenerator);
    router.post("/safety-alert-generator", validate(schemas.SafetyAlertInputSchema), controller.safetyAlertGenerator);
    router.post("/trend-analysis", validate(schemas.TrendAnalysisInputSchema), controller.trendAnalysis);
    router.post("/corrective-action-recommendation", validate(schemas.CorrectiveActionInputSchema), controller.correctiveActionRecommendation);
    router.post("/kpi-forecasting", validate(schemas.KpiForecastInputSchema), controller.kpiForecasting);
    router.post("/executive-reports", validate(schemas.ExecutiveReportInputSchema), controller.executiveReports);
    router.post("/feedback", validate(schemas.AiFeedbackSchema), controller.submitFeedback);
    router.get("/admin/settings", requireRole(["super-admin", "EHS-manager"]), controller.getGuardrailSettings);
    router.patch("/admin/settings", requireRole(["super-admin", "EHS-manager"]), controller.updateGuardrailSettings);
    router.get("/admin/prompt-audit", requireRole(["super-admin", "EHS-manager"]), controller.listPromptAudit);
    return router;
}
