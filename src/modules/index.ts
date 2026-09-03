import { createPermitsRouter } from "./permits/permits.module.js";
import { createComplianceRouter } from "./compliance/compliance.module.js";
import investigationsRouter from "../routes/investigations.js";
import { createTrainingRouter } from "./training/training.module.js";
import { createEquipmentRouter } from "./equipment/equipment.module.js";
import { createPpeRouter } from "./ppe/ppe.module.js";
import { createContractorsRouter } from "./contractors/contractors.module.js";
import { createEnvironmentalRouter } from "./environmental/environmental.module.js";
import { createHealthRouter } from "./health/health.module.js";
import { createSdsRouter } from "./sds/sds.module.js";
import { createFireRouter } from "./fire/fire.module.js";
import { createHeightWorkRouter } from "./heightwork/heightwork.module.js";
import { createScaffoldRouter } from "./scaffolding/scaffolding.module.js";
import governanceRouter from "../routes/governance.js";
import analyticsRouter from "../routes/analytics.js";
import { createDocumentsRouter } from "./documents/documents.module.js";
import notificationsRouter from "../routes/notifications.js";
import settingsRouter from "../routes/settings.js";
import { createRiskRouter } from "./risk/risk.module.js";
import { createKpiRouter } from "./kpi/kpi.module.js";
import { createReportsRouter as createPostgresReportsRouter } from "./reports/reports.module.js";
import { createAiRouter } from "./ai/ai.module.js";
import { createWibaRouter } from "./wiba/wiba.module.js";
import { createMocRouter } from "./moc/moc.module.js";
import { createOrganizationRouter } from "./organization/organization.controller.js";
import { createExposureMonitoringRouter } from "./exposure-monitoring/exposure-monitoring.controller.js";
import { createVisitorsRouter } from "./visitors/visitors.controller.js";
import { createSafetyAlertsRouter } from "./safety-alerts/safety-alerts.module.js";
import { createCalibrationsRouter } from "./calibrations/calibrations.module.js";
import { createLegalRegisterRouter } from "./legal-register/legal-register.module.js";
import { createInspectionsRouter } from "./inspections/inspections.controller.js";
import { createObservationsRouter } from "./observations/observations.controller.js";
import { createWorkplaceRegistrationRouter } from "./workplace-registration/workplace-registration.module.js";

export {
  createPermitsRouter,
  createComplianceRouter,
  createTrainingRouter,
  createEquipmentRouter,
  createPpeRouter,
  createContractorsRouter,
  createEnvironmentalRouter,
  createHealthRouter,
  createSdsRouter,
  createFireRouter,
  createHeightWorkRouter,
  createScaffoldRouter,
  createDocumentsRouter,
  createRiskRouter,
  createKpiRouter,
  createAiRouter,
  createWibaRouter,
  createMocRouter,
  createOrganizationRouter,
  createExposureMonitoringRouter,
  createVisitorsRouter,
  createSafetyAlertsRouter,
  createCalibrationsRouter,
  createLegalRegisterRouter,
  createInspectionsRouter,
  createObservationsRouter,
  createWorkplaceRegistrationRouter,
};

export function createReportsRouter() {
  return createPostgresReportsRouter();
}

export function createInvestigationsRouter() {
  return investigationsRouter;
}

export function createGovernanceRouter() {
  return governanceRouter;
}

export function createAnalyticsRouter() {
  return analyticsRouter;
}

export function createNotificationsRouter() {
  return notificationsRouter;
}

export function createSettingsRouter() {
  return settingsRouter;
}
export * from "./assignments/assignments.module.js";
