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
import { createReportsRouter as createPostgresReportsRouter } from "./reports/reports.module.js";

export { createPermitsRouter } from "./permits/permits.module.js";

export { createComplianceRouter } from "./compliance/compliance.module.js";

export function createInvestigationsRouter() {
  return investigationsRouter;
}

export { createAiRouter } from "./ai/ai.module.js";

export { createTrainingRouter } from "./training/training.module.js";

export { createEquipmentRouter } from "./equipment/equipment.module.js";

export { createPpeRouter } from "./ppe/ppe.module.js";

export { createContractorsRouter } from "./contractors/contractors.module.js";

export { createEnvironmentalRouter } from "./environmental/environmental.module.js";

export { createHealthRouter } from "./health/health.module.js";

export { createSdsRouter } from "./sds/sds.module.js";

export { createFireRouter } from "./fire/fire.module.js";

export { createHeightWorkRouter } from "./heightwork/heightwork.module.js";

export { createScaffoldRouter } from "./scaffolding/scaffolding.module.js";

export function createGovernanceRouter() {
  return governanceRouter;
}

export function createAnalyticsRouter() {
  return analyticsRouter;
}

export function createReportsRouter() {
  return createPostgresReportsRouter();
}

export function createNotificationsRouter() {
  return notificationsRouter;
}

export { createDocumentsRouter } from "./documents/documents.module.js";

export function createSettingsRouter() {
  return settingsRouter;
}
