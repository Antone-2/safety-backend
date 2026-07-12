import investigationsRouter from "../routes/investigations.js";
import governanceRouter from "../routes/governance.js";
import analyticsRouter from "../routes/analytics.js";
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
