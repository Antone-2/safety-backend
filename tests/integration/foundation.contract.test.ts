import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROLE_PERMISSIONS } from "../../src/shared/middleware/rbac.middleware.js";
import {
  INCIDENT_WORKFLOW,
  PERMIT_WORKFLOW,
} from "../../src/shared/workflow/workflow.engine.js";
import { POSTGRES_MIGRATIONS } from "../../src/shared/infrastructure/database/migrations.js";

const backendIndexSource = readFileSync(
  path.resolve(import.meta.dirname, "../../src/index.ts"),
  "utf8",
);
const frontendApiSource = readFileSync(
  path.resolve(import.meta.dirname, "../../../safety-frontend/src/lib/api-source.ts"),
  "utf8",
);
const frontendDataSource = readFileSync(
  path.resolve(import.meta.dirname, "../../../safety-frontend/src/lib/data-source.ts"),
  "utf8",
);

describe("backend foundation contracts", () => {
  it("keeps privileged roles connected to critical workflow permissions", () => {
    expect(ROLE_PERMISSIONS["EHS-manager"]).toContain("incidents:update");
    expect(ROLE_PERMISSIONS["EHS-manager"]).toContain("capa:verify");
    expect(ROLE_PERMISSIONS["EHS-manager"]).toContain("permits:approve");
  });

  it("defines final states for core workflows", () => {
    expect(INCIDENT_WORKFLOW.finalStates).toContain("Closed");
    expect(PERMIT_WORKFLOW.finalStates).toEqual(
      expect.arrayContaining(["closed", "rejected"]),
    );
  });

  it("includes the Postgres reports foundation migration", () => {
    const reportsMigration = POSTGRES_MIGRATIONS.find(
      (migration) => migration.id === "006_foundation_reports",
    );
    expect(reportsMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS reports",
    );
    expect(reportsMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS report_comments",
    );
  });

  it("includes the Postgres CAPA foundation migration", () => {
    const capaMigration = POSTGRES_MIGRATIONS.find(
      (migration) => migration.id === "007_foundation_capa",
    );
    expect(capaMigration?.sql).toContain("CREATE TABLE IF NOT EXISTS capa");
    expect(capaMigration?.sql).toContain("capa_no TEXT NOT NULL UNIQUE");
  });

  it("includes Google Sheets sync state migration", () => {
    const syncMigration = POSTGRES_MIGRATIONS.find(
      (migration) => migration.id === "008_google_sheets_sync_state",
    );
    expect(syncMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS google_sheets_sync_state",
    );
    expect(syncMigration?.sql).toContain("last_imported_count");
  });

  it("includes persistent authentication security storage", () => {
    const authMigration = POSTGRES_MIGRATIONS.find(
      (migration) => migration.id === "009_auth_security",
    );
    expect(authMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS auth_otp_challenges",
    );
    expect(authMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS auth_sessions",
    );
    expect(authMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS auth_login_audit",
    );
    expect(authMigration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS user_preferences",
    );
  });

  it("includes enterprise document-control storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "025_enterprise_document_control",
    );
    expect(migration?.sql).toContain("CREATE TABLE IF NOT EXISTS documents");
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS document_versions",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS document_approvals",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS document_acknowledgements",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS document_access_links",
    );
  });

  it("includes governed analytics storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "014_analytics_governance",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS analytics_report_templates",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS analytics_report_schedules",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS analytics_report_runs",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS analytics_report_signoffs",
    );
  });

  it("includes AI governance and prompt audit storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "015_ai_governance_guardrails",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS ai_guardrail_settings",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS ai_prompt_audit",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS ai_rag_sources",
    );
  });

  it("includes centralized notification storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "016_notification_center",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS notification_templates",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS notification_jobs",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS notification_recipients",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS notification_digest_subscriptions",
    );
  });

  it("includes corrective action request workflow storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "040_corrective_action_requests",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS corrective_action_requests",
    );
    expect(migration?.sql).toContain("access_token TEXT NOT NULL UNIQUE");
    expect(migration?.sql).toContain("action_plan_items JSONB NOT NULL DEFAULT '[]'::jsonb");
  });

  it("includes operations monitoring storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "017_operations_monitoring",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS operational_events",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS scheduler_runs",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS slow_query_logs",
    );
  });

  it("includes security hardening storage", () => {
    const migration = POSTGRES_MIGRATIONS.find(
      (item) => item.id === "018_security_hardening",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS security_policies",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS auth_rate_limits",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS file_security_scans",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS data_retention_policies",
    );
    expect(migration?.sql).toContain(
      "CREATE TABLE IF NOT EXISTS secrets_rotation_log",
    );
  });

  it("keeps the main backend mounting critical ERP routes", () => {
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/audit", auditRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/context", contextRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/emergency", emergencyRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/esg", esgRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/jsa", jsaRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/objectives", objectivesRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/risk", riskRouter)');
    expect(backendIndexSource).toContain('mountAll(API_PREFIXES, "/spill", spillRouter)');
  });

  it("keeps frontend ERP clients pointed at mounted backend endpoints", () => {
    expect(frontendApiSource).toContain('buildUrl("/api/objectives"');
    expect(frontendApiSource).toContain('buildUrl("/api/audit"');
    expect(frontendApiSource).toContain('buildUrl("/api/context/analysis"');
    expect(frontendApiSource).toContain('buildUrl("/api/context/parties"');

    expect(frontendDataSource).toContain('buildUrl("/api/risk/registers"');
    expect(frontendDataSource).toContain('buildUrl("/api/risk/dashboard"');
    expect(frontendDataSource).toContain('buildUrl("/api/jsa"');
    expect(frontendDataSource).toContain('buildUrl("/api/emergency/plans"');
    expect(frontendDataSource).toContain('buildUrl("/api/emergency/drills"');
    expect(frontendDataSource).toContain('buildUrl("/api/emergency/contacts"');
    expect(frontendDataSource).toContain('buildUrl("/api/emergency/stats"');
    expect(frontendDataSource).toContain('buildUrl("/api/esg/carbon"');
    expect(frontendDataSource).toContain('buildUrl("/api/esg/energy"');
    expect(frontendDataSource).toContain('buildUrl("/api/esg/water"');
    expect(frontendDataSource).toContain('buildUrl("/api/esg/dashboard"');
    expect(frontendDataSource).toContain('buildUrl(`/api/reports/${encodeURIComponent(reportId)}/corrective-action-requests`)');
    expect(frontendDataSource).toContain('buildUrl(`/api/reports/corrective-action-requests/${encodeURIComponent(token)}`)');
    expect(frontendDataSource).toContain('buildUrl(`/api/reports/corrective-action-requests/${encodeURIComponent(token)}/submit`)');
  });
});
