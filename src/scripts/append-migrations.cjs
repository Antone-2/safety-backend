const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../shared/infrastructure/database/migrations.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find the last "];" which closes the POSTGRES_MIGRATIONS array
const lastBracketIndex = content.lastIndexOf('\n];\n');
if (lastBracketIndex === -1) {
  console.error('Could not find end of array marker');
  process.exit(1);
}

const before = content.substring(0, lastBracketIndex + 1); // includes the closing ];

var NEWLINE = "\n";
var INDENT4 = "    ";
var INDENT6 = "      ";

var migration050 = [
  "  {",
  '    id: "050_statutory_audit_records_unique_key",',
  '    description: "Ensure statutory audit rows are unique per location and audit type",',
  '    sql: "DO $func$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = \'statutory_audit_records_location_audit_unique\') THEN ALTER TABLE statutory_audit_records ADD CONSTRAINT statutory_audit_records_location_audit_unique UNIQUE (location_category, location_name, audit_type); END IF; END $func$;",',
  "  },",
  "  {",
  '    id: "051_wiba_claims",',
  '    description: "Create WIBA claims table",',
  "    sql: [" +
    NEWLINE + INDENT6 + "'CREATE TABLE IF NOT EXISTS wiba_claims ('," +
    NEWLINE + INDENT6 + "'  id TEXT PRIMARY KEY,'," +
    NEWLINE + INDENT6 + "'  claim_no TEXT NOT NULL UNIQUE,'," +
    NEWLINE + INDENT6 + "'  date_of_injury DATE NOT NULL,'," +
    NEWLINE + INDENT6 + "'  nature_of_injury TEXT NOT NULL,'," +
    NEWLINE + INDENT6 + "'  claimant_name TEXT NOT NULL,'," +
    NEWLINE + INDENT6 + "'  status TEXT NOT NULL DEFAULT \\'Open\\','," +
    NEWLINE + INDENT6 + "'  stage TEXT NOT NULL DEFAULT \\'None\\','," +
    NEWLINE + INDENT6 + "'  amount_awarded_kes NUMERIC,'," +
    NEWLINE + INDENT6 + "'  company_claim_kes NUMERIC,'," +
    NEWLINE + INDENT6 + "'  outstanding_documents JSONB NOT NULL DEFAULT \\'[]\\'::jsonb,'," +
    NEWLINE + INDENT6 + "'  remarks TEXT,'," +
    NEWLINE + INDENT6 + "'  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),'," +
    NEWLINE + INDENT6 + "'  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()'," +
    NEWLINE + INDENT6 + "')," +
    NEWLINE + INDENT6 + "'CREATE INDEX IF NOT EXISTS idx_wiba_claims_date_of_injury ON wiba_claims(date_of_injury DESC);'," +
    NEWLINE + INDENT6 + "'CREATE INDEX IF NOT EXISTS idx_wiba_claims_status ON wiba_claims(status);'," +
    NEWLINE + INDENT6 + "'CREATE INDEX IF NOT EXISTS idx_wiba_claims_claimant_name ON wiba_claims(claimant_name);'," +
    NEWLINE + INDENT4 + "].join(" + NEWLINE + ")," +
  "  },",
  "  {",
  '    id: "052_workplace_registrations",',
  '    description: "Create workplace registrations table for certificate tracking",',
  "    sql: [" +
    NEWLINE + INDENT6 + "'CREATE TABLE IF NOT EXISTS workplace_registrations ('," +
    NEWLINE + INDENT6 + "'  id TEXT PRIMARY KEY,'," +
    NEWLINE + INDENT6 + "'  location TEXT NOT NULL,'," +
    NEWLINE + INDENT6 + "'  certificate_no TEXT NOT NULL DEFAULT \\'\\','," +
    NEWLINE + INDENT6 + "'  date_of_issue DATE,'," +
    NEWLINE + INDENT6 + "'  expiry_date DATE,'," +
    NEWLINE + INDENT6 + "'  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),'," +
    NEWLINE + INDENT6 + "'  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()'," +
    NEWLINE + INDENT6 + "')," +
    NEWLINE + INDENT6 + "'CREATE INDEX IF NOT EXISTS idx_workplace_registrations_location ON workplace_registrations(location);'," +
    NEWLINE + INDENT6 + "'CREATE INDEX IF NOT EXISTS idx_workplace_registrations_expiry_date ON workplace_registrations(expiry_date);'," +
    NEWLINE + INDENT4 + "].join(" + NEWLINE + ")," +
  "  },",
];

content = before + NEWLINE + migration050.join(NEWLINE) + NEWLINE + '];' + NEWLINE + NEWLINE + content.substring(lastBracketIndex + 4);
fs.writeFileSync(filePath, content, 'utf8');
console.log('SUCCESS: Added migrations 050, 051, 052');
