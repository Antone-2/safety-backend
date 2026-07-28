-- Migration: Fix timezone handling for report and dashboard date columns
-- Date: Tuesday, July 28, 2026
-- Business timezone: America/New_York
-- Summary:
--   1. Convert legacy TIMESTAMP columns to TIMESTAMPTZ using America/New_York
--      because Google Sheets rows were captured in sheet-local time without offsets.
--   2. Add local-date validation so rows after Tuesday, July 28, 2026 (or the
--      runtime current local date in production) are rejected.
--   3. Add expression indexes for AT TIME ZONE dashboard queries.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('reports', 'date', 'America/New_York'),
        ('reports', 'due_at', 'America/New_York'),
        ('reports', 'compliance_due_at', 'America/New_York'),
        ('incidents', 'date', 'America/New_York'),
        ('incidents', 'due_at', 'America/New_York'),
        ('incidents', 'regulatory_notification_date', 'America/New_York'),
        ('incidents', 'compliance_due_at', 'America/New_York'),
        ('capa', 'due_date', 'America/New_York'),
        ('capa', 'start_date', 'America/New_York'),
        ('capa', 'completed_date', 'America/New_York'),
        ('capa', 'verified_at', 'America/New_York'),
        ('permits', 'start_date', 'America/New_York'),
        ('permits', 'end_date', 'America/New_York'),
        ('training_records', 'scheduled_date', 'America/New_York'),
        ('training_records', 'completed_date', 'America/New_York'),
        ('training_records', 'expiry_date', 'America/New_York'),
        ('investigations', 'due_date', 'America/New_York'),
        ('investigations', 'completed_date', 'America/New_York'),
        ('investigations', 'reviewed_at', 'America/New_York'),
        ('documents', 'review_date', 'America/New_York'),
        ('documents', 'approval_date', 'America/New_York'),
        ('documents', 'effective_date', 'America/New_York'),
        ('documents', 'expiry_date', 'America/New_York'),
        ('documents', 'next_review_date', 'America/New_York'),
        ('equipment', 'purchase_date', 'America/New_York'),
        ('equipment', 'installation_date', 'America/New_York'),
        ('equipment', 'warranty_expiry', 'America/New_York'),
        ('equipment', 'last_inspection_date', 'America/New_York'),
        ('equipment', 'next_inspection_date', 'America/New_York'),
        ('equipment_inspections', 'inspection_date', 'America/New_York'),
        ('equipment_inspections', 'next_inspection_due', 'America/New_York'),
        ('compliance_obligations', 'due_date', 'America/New_York'),
        ('compliance_obligations', 'last_compliance_date', 'America/New_York'),
        ('audits', 'start_date', 'America/New_York'),
        ('audits', 'end_date', 'America/New_York'),
        ('legal_updates', 'effective_date', 'America/New_York'),
        ('legal_updates', 'due_date', 'America/New_York'),
        ('hazard_reports', 'reported_at', 'America/New_York'),
        ('hazard_reports', 'resolved_at', 'America/New_York'),
        ('carbon_emissions', 'recorded_date', 'America/New_York'),
        ('energy_records', 'recorded_date', 'America/New_York'),
        ('water_records', 'recorded_date', 'America/New_York'),
        ('waste_records', 'generated_date', 'America/New_York'),
        ('waste_records', 'disposed_date', 'America/New_York'),
        ('ppe_equipment', 'issued_date', 'America/New_York'),
        ('ppe_equipment', 'expiry_date', 'America/New_York'),
        ('ppe_equipment', 'inspection_date', 'America/New_York'),
        ('ppe_equipment', 'inspection_due_date', 'America/New_York'),
        ('contractors', 'insurance_expiry', 'America/New_York'),
        ('contractors', 'last_audit_date', 'America/New_York'),
        ('contractors', 'induction_date', 'America/New_York'),
        ('contractors', 'induction_expiry', 'America/New_York'),
        ('contractor_incidents', 'date', 'America/New_York'),
        ('ehs_objectives', 'start_date', 'America/New_York'),
        ('ehs_objectives', 'end_date', 'America/New_York'),
        ('ehs_objectives', 'last_reviewed', 'America/New_York'),
        ('analytics_report_schedules', 'next_run_at', 'UTC'),
        ('analytics_report_schedules', 'last_run_at', 'UTC'),
        ('analytics_report_runs', 'period_start', 'UTC'),
        ('analytics_report_runs', 'period_end', 'UTC')
    ) AS cols(table_name, column_name, assumed_timezone)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rec.table_name
        AND column_name = rec.column_name
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE %L',
        rec.table_name,
        rec.column_name,
        rec.column_name,
        rec.assumed_timezone
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'date')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_date_not_future') THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_date_not_future
      CHECK ((date AT TIME ZONE 'America/New_York')::DATE <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'date')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_date_not_future') THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_date_not_future
      CHECK ((date AT TIME ZONE 'America/New_York')::DATE <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'equipment_inspections' AND column_name = 'inspection_date')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_inspections_date_not_future') THEN
    ALTER TABLE equipment_inspections
      ADD CONSTRAINT equipment_inspections_date_not_future
      CHECK ((inspection_date AT TIME ZONE 'America/New_York')::DATE <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_date_ny ON reports (((date AT TIME ZONE 'America/New_York')::DATE));
CREATE INDEX IF NOT EXISTS idx_incidents_date_ny ON incidents (((date AT TIME ZONE 'America/New_York')::DATE));
CREATE INDEX IF NOT EXISTS idx_reports_due_at_ny ON reports (((due_at AT TIME ZONE 'America/New_York')::DATE));

DO $$
BEGIN
  RAISE NOTICE 'Timezone migration completed for America/New_York business dates.';
END $$;
