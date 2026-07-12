import type { Pool, PoolClient } from "pg";
import { pgPool } from "./postgres.client.js";

export type PostgresMigration = {
  id: string;
  description: string;
  sql: string;
};

export const POSTGRES_MIGRATIONS: PostgresMigration[] = [
  {
    id: "001_foundation_extensions",
    description: "Enable UUID generation",
    sql: "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  },
  {
    id: "002_foundation_users",
    description: "Create users table",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        site TEXT,
        department TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_site ON users(site);
    `,
  },
  {
    id: "003_foundation_incidents",
    description: "Create incidents table",
    sql: `
      CREATE TABLE IF NOT EXISTS incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        location TEXT NOT NULL,
        department TEXT NOT NULL,
        shift TEXT NOT NULL,
        description TEXT NOT NULL,
        reporter TEXT NOT NULL,
        reporter_email TEXT,
        reporter_phone TEXT,
        anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        is_near_miss BOOLEAN NOT NULL DEFAULT FALSE,
        photo_url TEXT,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        assigned_to TEXT,
        assigned_to_copy JSONB NOT NULL DEFAULT '[]'::jsonb,
        sla_hours INTEGER NOT NULL DEFAULT 24,
        due_at TIMESTAMPTZ,
        resolution_days INTEGER,
        root_cause TEXT,
        corrective_action TEXT,
        preventive_action TEXT,
        investigation_method TEXT,
        witness_statement TEXT,
        regulatory_notification_required BOOLEAN NOT NULL DEFAULT FALSE,
        regulatory_notification_date TIMESTAMPTZ,
        compliance_required BOOLEAN NOT NULL DEFAULT FALSE,
        compliance_due_at TIMESTAMPTZ,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
      CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(location);
      CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
    `,
  },
  {
    id: "004_foundation_audit_logs",
    description: "Create immutable audit log table",
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id TEXT,
        actor_email TEXT,
        actor_role TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        changes JSONB NOT NULL DEFAULT '[]'::jsonb,
        context JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `,
  },
  {
    id: "005_foundation_workflow_instances",
    description: "Create workflow state tracking table",
    sql: `
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        state TEXT NOT NULL,
        assigned_to TEXT,
        due_at TIMESTAMPTZ,
        context JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(resource_type, resource_id, workflow_name)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_state ON workflow_instances(workflow_name, state);
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_due_at ON workflow_instances(due_at);
    `,
  },
  {
    id: "006_foundation_reports",
    description: "Create safety reports and comments tables",
    sql: `
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        location TEXT NOT NULL,
        reporter TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Open',
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        resolution_days INTEGER,
        sla_hours INTEGER NOT NULL,
        due_at TIMESTAMPTZ NOT NULL,
        assigned_to TEXT,
        assigned_to_copy JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_near_miss BOOLEAN NOT NULL DEFAULT FALSE,
        anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        department TEXT NOT NULL,
        shift TEXT NOT NULL,
        compliance_required BOOLEAN NOT NULL DEFAULT FALSE,
        compliance_due_at TIMESTAMPTZ,
        photo_url TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS report_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
      CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(location);
      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
      CREATE INDEX IF NOT EXISTS idx_report_comments_report_id ON report_comments(report_id);
    `,
  },
  {
    id: "007_foundation_capa",
    description: "Create CAPA table",
    sql: `
      CREATE TABLE IF NOT EXISTS capa (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        capa_no TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'Corrective',
        status TEXT NOT NULL DEFAULT 'Open',
        priority TEXT NOT NULL DEFAULT 'Medium',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        source_ref TEXT,
        linked_incident_id TEXT,
        linked_audit_id TEXT,
        linked_risk_id TEXT,
        root_cause TEXT,
        action_plan TEXT NOT NULL,
        owner TEXT NOT NULL,
        department TEXT NOT NULL,
        site TEXT NOT NULL,
        due_date TIMESTAMPTZ NOT NULL,
        start_date TIMESTAMPTZ,
        completed_date TIMESTAMPTZ,
        verification_note TEXT,
        verified_by TEXT,
        verified_at TIMESTAMPTZ,
        effectiveness_check TEXT,
        effectiveness_result TEXT,
        cost_estimate NUMERIC,
        actual_cost NUMERIC,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_capa_status ON capa(status);
      CREATE INDEX IF NOT EXISTS idx_capa_priority ON capa(priority);
      CREATE INDEX IF NOT EXISTS idx_capa_owner ON capa(owner);
      CREATE INDEX IF NOT EXISTS idx_capa_due_date ON capa(due_date);
      CREATE INDEX IF NOT EXISTS idx_capa_source ON capa(source);
    `,
  },
  {
    id: "008_google_sheets_sync_state",
    description: "Track Google Sheets background sync state",
    sql: `
      CREATE TABLE IF NOT EXISTS google_sheets_sync_state (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'idle',
        last_started_at TIMESTAMPTZ,
        last_finished_at TIMESTAMPTZ,
        last_success_at TIMESTAMPTZ,
        last_error TEXT,
        last_sheet_name TEXT,
        last_row_count INTEGER NOT NULL DEFAULT 0,
        last_imported_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO google_sheets_sync_state (id)
      VALUES ('google_forms')
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    id: "009_auth_security",
    description:
      "Persist OTP challenges, sessions, login audit, and profile preferences",
    sql: `
      CREATE TABLE IF NOT EXISTS auth_otp_challenges (
        email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), request_count INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ, ip_address TEXT, user_agent TEXT, refresh_hash TEXT
      );
      CREATE TABLE IF NOT EXISTS auth_login_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email TEXT NOT NULL, event TEXT NOT NULL, successful BOOLEAN NOT NULL,
        ip_address TEXT, user_agent TEXT, detail TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb, avatar_url TEXT,
        deactivation_requested_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);
      CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_login_audit(user_id, created_at DESC);
    `,
  },
  {
    id: "012_foundation_training",
    description: "Create training tables",
    sql: `
      CREATE TABLE IF NOT EXISTS training_courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        code TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        frequency TEXT NOT NULL,
        validity_months INTEGER,
        competency_required TEXT,
        passing_score INTEGER NOT NULL DEFAULT 80,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS training_records (
        id TEXT PRIMARY KEY,
        record_no TEXT,
        course_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        department TEXT NOT NULL,
        site TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Scheduled',
        scheduled_date TIMESTAMPTZ NOT NULL,
        completed_date TIMESTAMPTZ,
        trainer TEXT,
        score INTEGER,
        passed BOOLEAN,
        certificate_url TEXT,
        expiry_date TIMESTAMPTZ,
        feedback TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS training_matrices (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        course_id TEXT NOT NULL,
        frequency TEXT NOT NULL,
        mandatory BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_training_records_course ON training_records(course_id);
      CREATE INDEX IF NOT EXISTS idx_training_records_employee ON training_records(employee_id);
      CREATE INDEX IF NOT EXISTS idx_training_records_status ON training_records(status);
      CREATE INDEX IF NOT EXISTS idx_training_matrices_course ON training_matrices(course_id);
    `,
  },
  {
    id: "010_auth_session_refresh_hash",
    description: "Add refresh token hash storage to auth sessions",
    sql: `
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS refresh_hash TEXT;
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_hash ON auth_sessions(refresh_hash);
    `,
  },
  {
    id: "011_auth_email_change_challenges",
    description: "Persist email change verification challenges",
    sql: `
      CREATE TABLE IF NOT EXISTS auth_email_changes (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        new_email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_email_changes_new_email ON auth_email_changes(new_email);
    `,
  },
  {
    id: "013_foundation_permits",
    description: "Create permits tables",
    sql: `
      CREATE TABLE IF NOT EXISTS permits (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        location TEXT NOT NULL,
        applicant TEXT NOT NULL,
        applicant_contact TEXT,
        supervisor TEXT,
        ehs_officer TEXT,
        issuer TEXT,
        approver TEXT,
        description TEXT NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        hazards TEXT,
        precautions TEXT,
        ppe_required JSONB NOT NULL DEFAULT '[]'::jsonb,
        isolation_required BOOLEAN NOT NULL DEFAULT FALSE,
        isolation_details TEXT,
        fire_watch_required BOOLEAN NOT NULL DEFAULT FALSE,
        gas_test_required BOOLEAN NOT NULL DEFAULT FALSE,
        gas_test_result TEXT,
        gas_test_before TEXT,
        gas_test_after TEXT,
        fire_watch_assigned TEXT,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        comments JSONB NOT NULL DEFAULT '[]'::jsonb,
        linked_jsa_id TEXT,
        linked_incident_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
      CREATE INDEX IF NOT EXISTS idx_permits_type ON permits(type);
      CREATE INDEX IF NOT EXISTS idx_permits_location ON permits(location);
      CREATE INDEX IF NOT EXISTS idx_permits_applicant ON permits(applicant);
      CREATE INDEX IF NOT EXISTS idx_permits_start_date ON permits(start_date);
      CREATE INDEX IF NOT EXISTS idx_permits_end_date ON permits(end_date);
    `,
  },
  {
    id: "013_enterprise_document_control",
    description:
      "Add enterprise document control versions, approvals, acknowledgements, and signed access links",
    sql: `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        document_no TEXT,
        title TEXT NOT NULL,
        code TEXT,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Draft',
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        author TEXT NOT NULL,
        reviewer TEXT,
        approver TEXT,
        review_date TIMESTAMPTZ,
        approval_date TIMESTAMPTZ,
        effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expiry_date TIMESTAMPTZ,
        site TEXT NOT NULL DEFAULT 'Corporate',
        department TEXT NOT NULL DEFAULT 'SHEQ',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        parent_id TEXT,
        created_by TEXT NOT NULL DEFAULT 'System',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_no TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_cycle_days INTEGER;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS obsolete_reason TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'Internal';
      CREATE TABLE IF NOT EXISTS document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id TEXT NOT NULL,
        version TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        checksum TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(document_id, version)
      );
      CREATE TABLE IF NOT EXISTS document_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id TEXT NOT NULL,
        version TEXT NOT NULL,
        step TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        approver_id TEXT,
        approver_name TEXT,
        comments TEXT,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_acknowledgements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id TEXT NOT NULL,
        document_version TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        UNIQUE(document_id, document_version, user_id)
      );
      CREATE TABLE IF NOT EXISTS document_access_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        purpose TEXT NOT NULL DEFAULT 'download',
        created_by TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        download_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_approvals_document ON document_approvals(document_id, status);
      CREATE INDEX IF NOT EXISTS idx_document_ack_user ON document_acknowledgements(user_id, acknowledged_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_access_document ON document_access_links(document_id, expires_at);
    `,
  },
  {
    id: "014_analytics_governance",
    description:
      "Add governed analytics templates, schedules, report runs, and signoff records",
    sql: `
      CREATE TABLE IF NOT EXISTS analytics_report_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        module TEXT NOT NULL DEFAULT 'ehs',
        parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
        output_formats JSONB NOT NULL DEFAULT '["pdf","excel"]'::jsonb,
        approval_required BOOLEAN NOT NULL DEFAULT TRUE,
        owner_id TEXT,
        owner_name TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analytics_report_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES analytics_report_templates(id) ON DELETE CASCADE,
        cadence TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
        recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        next_run_at TIMESTAMPTZ,
        last_run_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analytics_report_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID REFERENCES analytics_report_templates(id) ON DELETE SET NULL,
        schedule_id UUID REFERENCES analytics_report_schedules(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'Generated',
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        data_quality_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        output_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
        generated_by TEXT NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analytics_report_signoffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID REFERENCES analytics_report_runs(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        signer_id TEXT NOT NULL,
        signer_name TEXT NOT NULL,
        comments TEXT,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_templates_type ON analytics_report_templates(type, active);
      CREATE INDEX IF NOT EXISTS idx_analytics_schedules_next_run ON analytics_report_schedules(active, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_runs_template ON analytics_report_runs(template_id, generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_signoffs_run ON analytics_report_signoffs(run_id, signed_at DESC);
    `,
  },
  {
    id: "015_ai_governance_guardrails",
    description:
      "Add AI access settings, prompt audit, and governed RAG source tracking",
    sql: `
      CREATE TABLE IF NOT EXISTS ai_guardrail_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        require_citations BOOLEAN NOT NULL DEFAULT TRUE,
        allow_exports BOOLEAN NOT NULL DEFAULT TRUE,
        max_source_records INTEGER NOT NULL DEFAULT 50,
        allowed_roles JSONB NOT NULL DEFAULT '["super-admin","EHS-manager","hse-officer","plant-manager","factory-manager"]'::jsonb,
        rag_sources JSONB NOT NULL DEFAULT '["policies","procedures","reports","capa","audits","training"]'::jsonb,
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO ai_guardrail_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS ai_prompt_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        user_email TEXT,
        user_role TEXT,
        feature TEXT NOT NULL,
        prompt_hash TEXT NOT NULL,
        prompt_excerpt TEXT NOT NULL,
        response_summary TEXT,
        model_version TEXT NOT NULL,
        confidence NUMERIC,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        denied BOOLEAN NOT NULL DEFAULT FALSE,
        denial_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_rag_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        version TEXT,
        permission TEXT,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source_type, source_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_audit_user ON ai_prompt_audit(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_audit_feature ON ai_prompt_audit(feature, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_rag_sources_type ON ai_rag_sources(source_type, indexed_at DESC);
    `,
  },
  {
    id: "014_foundation_compliance",
    description:
      "Create compliance tables for obligations, audits, and legal updates",
    sql: `
      CREATE TABLE IF NOT EXISTS compliance_obligations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        legislation TEXT NOT NULL,
        requirement TEXT NOT NULL,
        frequency TEXT NOT NULL,
        responsibility TEXT NOT NULL,
        site TEXT NOT NULL,
        department TEXT NOT NULL,
        due_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'Pending',
        last_compliance_date TIMESTAMPTZ,
        evidence TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Planned',
        site TEXT NOT NULL,
        department TEXT NOT NULL,
        lead_auditor TEXT NOT NULL,
        team_members JSONB NOT NULL DEFAULT '[]'::jsonb,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        scope TEXT,
        criteria TEXT,
        findings JSONB NOT NULL DEFAULT '[]'::jsonb,
        report_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS legal_updates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        legislation TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        effective_date TIMESTAMPTZ NOT NULL,
        summary TEXT NOT NULL,
        impact_assessment TEXT,
        action_required TEXT,
        assigned_to TEXT,
        due_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'New',
        source TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_obligations_status ON compliance_obligations(status);
      CREATE INDEX IF NOT EXISTS idx_compliance_obligations_site ON compliance_obligations(site);
      CREATE INDEX IF NOT EXISTS idx_compliance_obligations_due_date ON compliance_obligations(due_date);
      CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
      CREATE INDEX IF NOT EXISTS idx_audits_site ON audits(site);
      CREATE INDEX IF NOT EXISTS idx_legal_updates_status ON legal_updates(status);
      CREATE INDEX IF NOT EXISTS idx_legal_updates_effective_date ON legal_updates(effective_date);
    `,
  },
  {
    id: "015_foundation_equipment",
    description: "Create equipment and equipment inspections tables",
    sql: `
      CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        asset_tag TEXT NOT NULL,
        serial_number TEXT,
        manufacturer TEXT,
        model TEXT,
        location TEXT NOT NULL,
        site TEXT NOT NULL,
        department TEXT NOT NULL,
        purchase_date TIMESTAMPTZ,
        installation_date TIMESTAMPTZ,
        warranty_expiry TIMESTAMPTZ,
        last_inspection_date TIMESTAMPTZ,
        next_inspection_date TIMESTAMPTZ,
        inspection_frequency TEXT,
        status TEXT NOT NULL DEFAULT 'Operational',
        "condition" TEXT,
        assigned_to TEXT,
        notes TEXT,
        photo_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS equipment_inspections (
        id TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL,
        inspector TEXT NOT NULL,
        inspection_date TIMESTAMPTZ NOT NULL,
        inspection_type TEXT NOT NULL,
        findings TEXT,
        defects TEXT,
        action_required TEXT,
        passed BOOLEAN NOT NULL,
        next_inspection_due TIMESTAMPTZ NOT NULL,
        photo_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
      CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
      CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(location);
      CREATE INDEX IF NOT EXISTS idx_equipment_next_inspection ON equipment(next_inspection_date);
      CREATE INDEX IF NOT EXISTS idx_equipment_inspections_equipment ON equipment_inspections(equipment_id);
    `,
  },
  {
    id: "016_notification_center",
    description:
      "Add centralized notification templates, jobs, recipient delivery statuses, and digest subscriptions",
    sql: `
      CREATE TABLE IF NOT EXISTS notification_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_key TEXT NOT NULL UNIQUE,
        channel TEXT NOT NULL,
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notification_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_key TEXT NOT NULL,
        workflow TEXT,
        resource_type TEXT,
        resource_id TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TIMESTAMPTZ,
        last_error TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notification_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES notification_jobs(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        recipient_name TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        delivered_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        last_error TEXT,
        provider_message_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notification_digest_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        recipient TEXT NOT NULL,
        cadence TEXT NOT NULL DEFAULT 'daily',
        channels JSONB NOT NULL DEFAULT '["email","in-app"]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        next_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_notification_jobs_resource ON notification_jobs(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_notification_recipients_job ON notification_recipients(job_id, status);
      CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient ON notification_recipients(recipient, created_at DESC);
    `,
  },
  {
    id: "017_operations_monitoring",
    description:
      "Add operational event, scheduler run, and slow-query monitoring tables",
    sql: `
      CREATE TABLE IF NOT EXISTS operational_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS scheduler_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        duration_ms INTEGER,
        error TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS slow_query_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        threshold_ms INTEGER NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_operational_events_type ON operational_events(type, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scheduler_runs_job ON scheduler_runs(job_name, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_slow_query_logs_created ON slow_query_logs(created_at DESC);
    `,
  },
  {
    id: "018_security_hardening",
    description:
      "Add security policies, OTP throttling, file scan metadata, retention controls, and secrets rotation tracking",
    sql: `
      CREATE TABLE IF NOT EXISTS security_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        policy_key TEXT NOT NULL UNIQUE,
        policy_value JSONB NOT NULL DEFAULT '{}'::jsonb,
        description TEXT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope TEXT NOT NULL,
        identifier TEXT NOT NULL,
        action TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        blocked_until TIMESTAMPTZ,
        UNIQUE(scope, identifier, action)
      );
      CREATE TABLE IF NOT EXISTS file_security_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_key TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        checksum TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        scanner TEXT NOT NULL DEFAULT 'policy',
        findings JSONB NOT NULL DEFAULT '[]'::jsonb,
        scanned_at TIMESTAMPTZ,
        uploaded_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS data_retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type TEXT NOT NULL UNIQUE,
        retention_days INTEGER NOT NULL,
        legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
        disposal_action TEXT NOT NULL DEFAULT 'anonymize',
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS secrets_rotation_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        secret_name TEXT NOT NULL,
        owner TEXT NOT NULL,
        rotation_frequency_days INTEGER NOT NULL,
        last_rotated_at TIMESTAMPTZ,
        next_rotation_due_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        evidence TEXT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup ON auth_rate_limits(scope, identifier, action);
      CREATE INDEX IF NOT EXISTS idx_file_security_scans_status ON file_security_scans(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_retention_resource ON data_retention_policies(resource_type);
      CREATE INDEX IF NOT EXISTS idx_secrets_rotation_due ON secrets_rotation_log(status, next_rotation_due_at);
    `,
  },
  {
    id: "016_foundation_documents",
    description:
      "Create documents, versions, approvals, acknowledgements, and access links",
    sql: `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        code TEXT,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        status TEXT NOT NULL DEFAULT 'Draft',
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        author TEXT NOT NULL,
        reviewer TEXT,
        approver TEXT,
        review_date TIMESTAMPTZ,
        approval_date TIMESTAMPTZ,
        effective_date TIMESTAMPTZ NOT NULL,
        expiry_date TIMESTAMPTZ,
        site TEXT NOT NULL,
        department TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        parent_id TEXT,
        created_by TEXT NOT NULL,
        document_no TEXT,
        owner TEXT,
        review_cycle_days INTEGER,
        next_review_date TIMESTAMPTZ,
        obsolete_reason TEXT,
        classification TEXT NOT NULL DEFAULT 'Internal',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        content TEXT,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        checksum TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(document_id, version)
      );
      CREATE TABLE IF NOT EXISTS document_approvals (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version TEXT NOT NULL,
        step TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        approver_id TEXT,
        approver_name TEXT,
        comments TEXT,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_acknowledgements (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        document_version TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        UNIQUE(document_id, document_version, user_id)
      );
      CREATE TABLE IF NOT EXISTS document_access_links (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        purpose TEXT NOT NULL DEFAULT 'download',
        created_by TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        download_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_documents_site ON documents(site);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
      CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_approvals_document ON document_approvals(document_id, status);
      CREATE INDEX IF NOT EXISTS idx_document_ack_user ON document_acknowledgements(user_id, acknowledged_at DESC);
      CREATE INDEX IF NOT EXISTS idx_document_access_document ON document_access_links(document_id, expires_at);
    `,
  },
  {
    id: "017_foundation_ppe",
    description: "Create PPE equipment table",
    sql: `
      CREATE TABLE IF NOT EXISTS ppe_equipment (
        id TEXT PRIMARY KEY,
        ppe_no TEXT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT,
        department TEXT,
        site TEXT NOT NULL,
        issued_date TIMESTAMPTZ,
        expiry_date TIMESTAMPTZ,
        condition TEXT,
        inspection_date TIMESTAMPTZ,
        inspection_due_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'Issued',
        serial_number TEXT,
        certificate_url TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ppe_type ON ppe_equipment(type);
      CREATE INDEX IF NOT EXISTS idx_ppe_site ON ppe_equipment(site);
      CREATE INDEX IF NOT EXISTS idx_ppe_status ON ppe_equipment(status);
      CREATE INDEX IF NOT EXISTS idx_ppe_assigned_to ON ppe_equipment(assigned_to);
    `,
  },
  {
    id: "018_foundation_contractors",
    description: "Create contractors and contractor incidents tables",
    sql: `
      CREATE TABLE IF NOT EXISTS contractors (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        registration_number TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        physical_address TEXT,
        services TEXT,
        certifications TEXT,
        insurance_expiry TIMESTAMPTZ,
        safety_rating NUMERIC,
        incidents INTEGER NOT NULL DEFAULT 0,
        last_audit_date TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'Active',
        induction_date TIMESTAMPTZ,
        induction_expiry TIMESTAMPTZ,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        performance_score NUMERIC,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS contractor_incidents (
        id TEXT PRIMARY KEY,
        contractor_id TEXT NOT NULL,
        incident_type TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        date TIMESTAMPTZ NOT NULL,
        location TEXT NOT NULL,
        action_taken TEXT,
        follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);
      CREATE INDEX IF NOT EXISTS idx_contractors_company ON contractors(company_name);
      CREATE INDEX IF NOT EXISTS idx_contractor_incidents_contractor ON contractor_incidents(contractor_id, created_at DESC);
    `,
  },
  {
    id: "019_foundation_environmental",
    description: "Create environmental tables for waste, emissions, chemicals, and spills",
    sql: `
      CREATE TABLE IF NOT EXISTS waste_records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        generated_date TIMESTAMPTZ NOT NULL,
        stored_location TEXT NOT NULL,
        disposed_date TIMESTAMPTZ,
        disposal_method TEXT,
        disposal_contractor TEXT,
        manifest_number TEXT,
        status TEXT NOT NULL DEFAULT 'Stored',
        photo_url TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS emissions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        parameter TEXT NOT NULL,
        location TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        limit NUMERIC,
        monitored_date TIMESTAMPTZ NOT NULL,
        monitored_by TEXT NOT NULL,
        equipment TEXT,
        corrective_action TEXT,
        status TEXT NOT NULL DEFAULT 'Within Limit',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chemicals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cas_number TEXT,
        formula TEXT,
        quantity NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        storage_location TEXT NOT NULL,
        hazard_class TEXT,
        sds_url TEXT,
        expiry_date TIMESTAMPTZ,
        supplier TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS spills (
        id TEXT PRIMARY KEY,
        chemical TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        location TEXT NOT NULL,
        date DATE NOT NULL,
        time TEXT NOT NULL,
        severity TEXT NOT NULL,
        affected_area TEXT,
        response_actions TEXT,
        cleanup_completed BOOLEAN NOT NULL DEFAULT FALSE,
        cleanup_date TIMESTAMPTZ,
        reported_to_nema BOOLEAN NOT NULL DEFAULT FALSE,
        nema_report_date TIMESTAMPTZ,
        photo_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_waste_type ON waste_records(type);
      CREATE INDEX IF NOT EXISTS idx_waste_status ON waste_records(status);
      CREATE INDEX IF NOT EXISTS idx_emissions_type ON emissions(type);
      CREATE INDEX IF NOT EXISTS idx_emissions_location ON emissions(location);
      CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name);
      CREATE INDEX IF NOT EXISTS idx_spills_severity ON spills(severity);
      CREATE INDEX IF NOT EXISTS idx_spills_location ON spills(location);
    `,
  },
  {
    id: "020_foundation_health",
    description: "Create health surveillance table",
    sql: `
      CREATE TABLE IF NOT EXISTS health_surveillance (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        department TEXT NOT NULL,
        site TEXT NOT NULL,
        type TEXT NOT NULL,
        examination_date TIMESTAMPTZ NOT NULL,
        next_due_date TIMESTAMPTZ NOT NULL,
        frequency TEXT NOT NULL,
        results TEXT,
        findings TEXT,
        restrictions TEXT,
        fitness_for_work BOOLEAN NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_registration TEXT,
        clinic_name TEXT,
        report_url TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_health_employee_id ON health_surveillance(employee_id);
      CREATE INDEX IF NOT EXISTS idx_health_site ON health_surveillance(site);
      CREATE INDEX IF NOT EXISTS idx_health_type ON health_surveillance(type);
      CREATE INDEX IF NOT EXISTS idx_health_next_due_date ON health_surveillance(next_due_date);
      CREATE INDEX IF NOT EXISTS idx_health_fitness ON health_surveillance(fitness_for_work);
    `,
  },
  {
    id: "021_foundation_fire",
    description: "Create fire equipment and inspections tables",
    sql: `
      CREATE TABLE IF NOT EXISTS fire_equipment (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        location TEXT NOT NULL,
        building TEXT NOT NULL,
        floor TEXT,
        room TEXT,
        asset_tag TEXT NOT NULL,
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        installation_date TIMESTAMPTZ,
        last_inspection_date TIMESTAMPTZ,
        next_inspection_date TIMESTAMPTZ,
        inspection_frequency TEXT,
        status TEXT NOT NULL DEFAULT 'Operational',
        notes TEXT,
        photo_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fire_inspections (
        id TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL,
        inspector TEXT NOT NULL,
        inspection_date TIMESTAMPTZ NOT NULL,
        findings TEXT,
        defects TEXT,
        action_required TEXT,
        passed BOOLEAN NOT NULL,
        next_inspection_due TIMESTAMPTZ NOT NULL,
        photo_url TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fire_equipment_type ON fire_equipment(type);
      CREATE INDEX IF NOT EXISTS idx_fire_equipment_location ON fire_equipment(location);
      CREATE INDEX IF NOT EXISTS idx_fire_equipment_status ON fire_equipment(status);
      CREATE INDEX IF NOT EXISTS idx_fire_equipment_next_inspection ON fire_equipment(next_inspection_date);
      CREATE INDEX IF NOT EXISTS idx_fire_inspections_equipment ON fire_inspections(equipment_id, created_at DESC);
    `,
  },
  {
    id: "022_foundation_heightwork",
    description: "Create height work table",
    sql: `
      CREATE TABLE IF NOT EXISTS height_works (
        id TEXT PRIMARY KEY,
        permit_no TEXT,
        location TEXT NOT NULL,
        building TEXT NOT NULL,
        floor TEXT,
        task_description TEXT NOT NULL,
        height NUMERIC NOT NULL,
        fall_protection TEXT,
        rescue_plan TEXT,
        harness_inspection_date TIMESTAMPTZ,
        anchor_point_inspected BOOLEAN NOT NULL DEFAULT FALSE,
        workers_count INTEGER NOT NULL,
        workers TEXT,
        supervisor TEXT NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'Planned',
        incident_report TEXT,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_height_work_status ON height_works(status);
      CREATE INDEX IF NOT EXISTS idx_height_work_location ON height_works(location);
      CREATE INDEX IF NOT EXISTS idx_height_work_supervisor ON height_works(supervisor);
    `,
  },
  {
    id: "023_foundation_sds",
    description: "Create SDS library table",
    sql: `
      CREATE TABLE IF NOT EXISTS sds_library (
        id TEXT PRIMARY KEY,
        sds_no TEXT,
        chemical_name TEXT NOT NULL,
        cas_number TEXT,
        formula TEXT,
        supplier TEXT,
        sds_url TEXT,
        hazard_class TEXT,
        signal_word TEXT,
        pictograms TEXT,
        storage_requirements TEXT,
        ppe_required TEXT,
        first_aid_measure TEXT,
        spill_procedures TEXT,
        effective_date TIMESTAMPTZ,
        next_review_date TIMESTAMPTZ,
        version TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        location TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sds_chemical_name ON sds_library(chemical_name);
      CREATE INDEX IF NOT EXISTS idx_sds_status ON sds_library(status);
      CREATE INDEX IF NOT EXISTS idx_sds_supplier ON sds_library(supplier);
      CREATE INDEX IF NOT EXISTS idx_sds_next_review_date ON sds_library(next_review_date);
    `,
  },
];

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function runPostgresMigrations(
  pool: Pool = pgPool,
): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query("BEGIN");
    await ensureMigrationsTable(client);

    for (const migration of POSTGRES_MIGRATIONS) {
      const existing = await client.query(
        "SELECT id FROM schema_migrations WHERE id = $1",
        [migration.id],
      );
      if ((existing.rowCount ?? 0) > 0) continue;

      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (id, description) VALUES ($1, $2)",
        [migration.id, migration.description],
      );
      applied.push(migration.id);
    }

    await client.query("COMMIT");
    return applied;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
