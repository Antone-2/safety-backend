import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import { AiService } from "./ai.service.js";
import {
  authenticateUser,
  requireRole,
  type AuthRequest,
} from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import * as schemas from "./ai.types.js";
import {
  NotFoundError,
  BusinessRuleError,
} from "../../shared/domain/errors/index.js";

export function createAiController(service: AiService) {
  return {
    async investigationAssistant(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.InvestigationInputSchema>;
      const result = await service.investigationAssistant(data, req.user?.id);
      res.json(result);
    },

    async rootCauseAnalysis(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.RootCauseInputSchema>;
      const result = await service.rootCauseAnalysis(data, req.user?.id);
      res.json(result);
    },

    async hazardDetection(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.HazardDetectionInputSchema
      >;
      const result = await service.hazardDetection(data, req.user?.id);
      res.json(result);
    },

    async riskPrediction(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.RiskPredictionInputSchema
      >;
      const result = await service.riskPrediction(data, req.user?.id);
      res.json(result);
    },

    async chatbot(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.ChatbotInputSchema>;
      const result = await service.chatbot(data, req.user?.id);
      res.json(result);
    },

    async query(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.AiQueryInputSchema>;
      const result = await service.query(data, req.user);
      res.json(result);
    },

    async complianceAssistant(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.ComplianceInputSchema>;
      const result = await service.complianceAssistant(data, req.user?.id);
      res.json(result);
    },

    async trainingRecommendation(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.TrainingInputSchema>;
      const result = await service.trainingRecommendation(data, req.user?.id);
      res.json(result);
    },

    async permitValidation(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.PermitInputSchema>;
      const result = await service.permitValidation(data, req.user?.id);
      res.json(result);
    },

    async inspectionAssistant(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.InspectionInputSchema>;
      const result = await service.inspectionAssistant(data, req.user?.id);
      res.json(result);
    },

    async safetyObservationAnalysis(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.ObservationInputSchema>;
      const result = await service.safetyObservationAnalysis(
        data,
        req.user?.id,
      );
      res.json(result);
    },

    async environmentalMonitoring(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.EnvironmentalInputSchema>;
      const result = await service.environmentalMonitoring(data, req.user?.id);
      res.json(result);
    },

    async predictiveAnalytics(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.PredictiveAnalyticsInputSchema
      >;
      const result = await service.predictiveAnalytics(data, req.user?.id);
      res.json(result);
    },

    async dashboardInsights(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.PredictiveAnalyticsInputSchema
      >;
      const result = await service.dashboardInsights(data, req.user?.id);
      res.json(result);
    },

    async documentSearch(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.DocumentSearchInputSchema
      >;
      const result = await service.documentSearch(data, req.user?.id);
      res.json(result);
    },

    async toolboxTalkGenerator(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.ToolboxTalkInputSchema>;
      const result = await service.toolboxTalkGenerator(data, req.user?.id);
      res.json(result);
    },

    async safetyAlertGenerator(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.SafetyAlertInputSchema>;
      const result = await service.safetyAlertGenerator(data, req.user?.id);
      res.json(result);
    },

    async trendAnalysis(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.TrendAnalysisInputSchema>;
      const result = await service.trendAnalysis(data, req.user?.id);
      res.json(result);
    },

    async correctiveActionRecommendation(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.CorrectiveActionInputSchema
      >;
      const result = await service.correctiveActionRecommendation(
        data,
        req.user?.id,
      );
      res.json(result);
    },

    async kpiForecasting(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.KpiForecastInputSchema>;
      const result = await service.kpiForecasting(data, req.user?.id);
      res.json(result);
    },

    async executiveReports(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<
        typeof schemas.ExecutiveReportInputSchema
      >;
      const result = await service.executiveReports(data, req.user?.id);
      res.json(result);
    },

    async submitFeedback(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof schemas.AiFeedbackSchema>;
      const repository = (service as any)
        .repository as import("./ai.repository.js").AiRepository;
      const feedback = await repository.saveFeedback({
        feature: data.feature,
        predictionId: data.predictionId,
        userId: req.user?.id || "",
        rating: data.rating,
        feedbackText: data.feedbackText,
      });
      res.status(201).json({ success: true, data: { id: feedback } });
    },

    async getGuardrailSettings(req: AuthRequest, res: Response) {
      const repository = service.getRepository();
      const settings = await repository.getGuardrailSettings();
      res.json({ success: true, data: settings });
    },

    async updateGuardrailSettings(req: AuthRequest, res: Response) {
      const repository = service.getRepository();
      const settings = await repository.updateGuardrailSettings(
        req.body,
        req.user?.email || req.user?.name,
      );
      res.json({ success: true, data: settings });
    },

    async listPromptAudit(req: AuthRequest, res: Response) {
      const repository = service.getRepository();
      const audit = await repository.listPromptAudit({
        feature:
          typeof req.query.feature === "string" ? req.query.feature : undefined,
        userId:
          typeof req.query.userId === "string" ? req.query.userId : undefined,
        limit:
          typeof req.query.limit === "string" ? Number(req.query.limit) : 100,
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

  router.post(
    "/investigation-assistant",
    validate(schemas.InvestigationInputSchema),
    controller.investigationAssistant,
  );
  router.post(
    "/root-cause-analysis",
    validate(schemas.RootCauseInputSchema),
    controller.rootCauseAnalysis,
  );
  router.post(
    "/hazard-detection",
    validate(schemas.HazardDetectionInputSchema),
    controller.hazardDetection,
  );
  router.post(
    "/risk-prediction",
    validate(schemas.RiskPredictionInputSchema),
    controller.riskPrediction,
  );
  router.post("/query", validate(schemas.AiQueryInputSchema), controller.query);
  router.post(
    "/chatbot/chat",
    validate(schemas.ChatbotInputSchema),
    controller.chatbot,
  );
  router.post(
    "/compliance-assistant",
    validate(schemas.ComplianceInputSchema),
    controller.complianceAssistant,
  );
  router.post(
    "/training-recommendation",
    validate(schemas.TrainingInputSchema),
    controller.trainingRecommendation,
  );
  router.post(
    "/permit-validation",
    validate(schemas.PermitInputSchema),
    controller.permitValidation,
  );
  router.post(
    "/inspection-assistant",
    validate(schemas.InspectionInputSchema),
    controller.inspectionAssistant,
  );
  router.post(
    "/safety-observation-analysis",
    validate(schemas.ObservationInputSchema),
    controller.safetyObservationAnalysis,
  );
  router.post(
    "/environmental-monitoring",
    validate(schemas.EnvironmentalInputSchema),
    controller.environmentalMonitoring,
  );
  router.post(
    "/predictive-analytics",
    validate(schemas.PredictiveAnalyticsInputSchema),
    controller.predictiveAnalytics,
  );
  router.post(
    "/dashboard-insights",
    validate(schemas.PredictiveAnalyticsInputSchema),
    controller.dashboardInsights,
  );
  router.post(
    "/document-search",
    validate(schemas.DocumentSearchInputSchema),
    controller.documentSearch,
  );
  router.post(
    "/toolbox-talk-generator",
    validate(schemas.ToolboxTalkInputSchema),
    controller.toolboxTalkGenerator,
  );
  router.post(
    "/safety-alert-generator",
    validate(schemas.SafetyAlertInputSchema),
    controller.safetyAlertGenerator,
  );
  router.post(
    "/trend-analysis",
    validate(schemas.TrendAnalysisInputSchema),
    controller.trendAnalysis,
  );
  router.post(
    "/corrective-action-recommendation",
    validate(schemas.CorrectiveActionInputSchema),
    controller.correctiveActionRecommendation,
  );
  router.post(
    "/kpi-forecasting",
    validate(schemas.KpiForecastInputSchema),
    controller.kpiForecasting,
  );
  router.post(
    "/executive-reports",
    validate(schemas.ExecutiveReportInputSchema),
    controller.executiveReports,
  );
  router.post(
    "/feedback",
    validate(schemas.AiFeedbackSchema),
    controller.submitFeedback,
  );
  router.get(
    "/admin/settings",
    requireRole(["super-admin", "EHS-manager"]),
    controller.getGuardrailSettings,
  );
  router.patch(
    "/admin/settings",
    requireRole(["super-admin", "EHS-manager"]),
    controller.updateGuardrailSettings,
  );
  router.get(
    "/admin/prompt-audit",
    requireRole(["super-admin", "EHS-manager"]),
    controller.listPromptAudit,
  );

  return router;
}
