import { Router } from "express";
import { createAiRouter as createAuthenticatedAiRouter } from "./ai.controller.js";
export function createAiRouter() {
    const router = Router();
    router.get("/health", (_req, res) => {
        res.json({ status: "ok", module: "ai", features: 21 });
    });
    router.get("/", (_req, res) => {
        res.json({
            message: "AI Intelligence Engine",
            version: "1.1.0",
            features: [
                { id: "ai-query", name: "AI SHEQ Data Intelligence Query", endpoint: "/api/ai/query" },
                { id: "investigation-assistant", name: "AI Incident Investigation Assistant", endpoint: "/api/ai/investigation-assistant" },
                { id: "root-cause-analysis", name: "AI Root Cause Analysis", endpoint: "/api/ai/root-cause-analysis" },
                { id: "hazard-detection", name: "AI Hazard Detection", endpoint: "/api/ai/hazard-detection" },
                { id: "risk-prediction", name: "AI Risk Prediction", endpoint: "/api/ai/risk-prediction" },
                { id: "chatbot", name: "AI Safety Chatbot", endpoint: "/api/ai/chatbot/chat" },
                { id: "compliance-assistant", name: "AI Compliance Assistant", endpoint: "/api/ai/compliance-assistant" },
                { id: "training-recommendation", name: "AI Training Recommendation Engine", endpoint: "/api/ai/training-recommendation" },
                { id: "permit-validation", name: "AI Permit Validation", endpoint: "/api/ai/permit-validation" },
                { id: "inspection-assistant", name: "AI Inspection Assistant", endpoint: "/api/ai/inspection-assistant" },
                { id: "safety-observation-analysis", name: "AI Safety Observation Analysis", endpoint: "/api/ai/safety-observation-analysis" },
                { id: "environmental-monitoring", name: "AI Environmental Monitoring", endpoint: "/api/ai/environmental-monitoring" },
                { id: "predictive-analytics", name: "AI Predictive Analytics", endpoint: "/api/ai/predictive-analytics" },
                { id: "dashboard-insights", name: "AI Dashboard Insights", endpoint: "/api/ai/dashboard-insights" },
                { id: "document-search", name: "AI Document Search", endpoint: "/api/ai/document-search" },
                { id: "toolbox-talk-generator", name: "AI Toolbox Talk Generator", endpoint: "/api/ai/toolbox-talk-generator" },
                { id: "safety-alert-generator", name: "AI Safety Alert Generator", endpoint: "/api/ai/safety-alert-generator" },
                { id: "trend-analysis", name: "AI Trend Analysis", endpoint: "/api/ai/trend-analysis" },
                { id: "corrective-action-recommendation", name: "AI Corrective Action Recommendation", endpoint: "/api/ai/corrective-action-recommendation" },
                { id: "kpi-forecasting", name: "AI KPI Forecasting", endpoint: "/api/ai/kpi-forecasting" },
                { id: "executive-reports", name: "AI Executive Reports", endpoint: "/api/ai/executive-reports" },
            ],
        });
    });
    router.use(createAuthenticatedAiRouter());
    return router;
}
