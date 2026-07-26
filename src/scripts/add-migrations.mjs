import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = path.resolve(__dirname, '../shared/infrastructure/database/migrations.ts');

let content = fs.readFileSync(migrationFile, 'utf8');

// Find the last occurrence of "  },\n];" - the end of the POSTGRES_MIGRATIONS array
const idx = content.lastIndexOf('  },\n];');
if (idx === -1) {
  console.error('Could not find end of POSTGRES_MIGRATIONS array');
  process.exit(1);
}

const before = content.substring(0, idx + 4);
const after = content.substring(idx + 4);

const newMigrations = [
  {
    id: "050_statutory_audit_records_unique_key",
    description: "Ensure statutory audit rows are unique per location and audit type",
    sql: [
      "DO $$",
      "BEGIN",
      "  IF NOT EXISTS (",
      "    SELECT 1",
      "    FROM pg_constraint",
      "    WHERE conname = 'statutory_audit_records_location_audit_unique'",
      "  ) THEN",
      "    ALTER TABLE statutory_audit_records",
      "    ADD CONSTRAINT statutory_audit_records_location_audit_unique",
      "    UNIQUE (location_category, location_name, audit_type);",
      "  END IF;",
      "END",
      "$$;",
    ].join('\n'),
  },
  {
    id: "051_wiba_claims",
    description: "Create WIBA claims table",
    sql: [
      "CREATE TABLE IF NOT EXISTS wiba_claims (",
      "  id TEXT PRIMARY KEY,",
      "  claim_no TEXT NOT NULL UNIQUE,",
      "  date_of_injury DATE NOT NULL,",
      "  nature_of_injury TEXT NOT NULL,",
      "  claimant_name TEXT NOT NULL,",
      "  status TEXT NOT NULL DEFAULT 'Open',",
      "  stage TEXT NOT NULL DEFAULT 'None',",
      "  amount_awarded_kes NUMERIC,",
      "  company_claim_kes NUMERIC,",
      "  outstanding_documents JSONB NOT NULL DEFAULT '[]'::jsonb,",
      "  remarks TEXT,",
      "  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_wiba_claims_date_of_injury ON wiba_claims(date_of_injury DESC);",
      "CREATE INDEX IF NOT EXISTS idx_wiba_claims_status ON wiba_claims(status);",
      "CREATE INDEX IF NOT EXISTS idx_wiba_claims_claimant_name ON wiba_claims(claimant_name);",
    ].join('\n'),
  },
  {
    id: "052_workplace_registrations",
    description: "Create workplace registrations table for certificate tracking",
    sql: [
      "CREATE TABLE IF NOT EXISTS workplace_registrations (",
      "  id TEXT PRIMARY KEY,",
      "  location TEXT NOT NULL,",
      "  certificate_no TEXT NOT NULL DEFAULT '',",
      "  date_of_issue DATE,",
      "  expiry_date DATE,",
      "  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_workplace_registrations_location ON workplace_registrations(location);",
      "CREATE INDEX IF NOT EXISTS idx_workplace_registrations_expiry_date ON workplace_registrations(expiry_date);",
    ].join('\n'),
  },
];

let newEntries = '';
for (const m of newMigrations) {
  const indentedSql = '      ' + m.sql.replace(/\n/g, '\n      ');
  newEntries += [
    '  {',
    `    id: "${m.id}",`,
    `    description: "${m.description}",`,
    '    sql: `',
    indentedSql.trimEnd(),
    '    `,',
    '  },',
  ].join('\n') + '\n';
}

const finalContent = before + '\n' + newEntries + after;
fs.writeFileSync(migrationFile, finalContent, 'utf8');
console.log('SUCCESS: Added migrations 050, 051, 052');
