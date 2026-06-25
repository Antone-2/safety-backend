const DEFAULT_FIELDS = [
  "location",
  "reporter",
  "description",
  "severity",
  "status",
  "category",
  "type",
  "department",
  "shift",
  "assignedTo",
  "photoUrl",
] as const;

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function describeFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[] = DEFAULT_FIELDS,
) {
  const changes = fields
    .filter((field) => String(before[field] ?? "") !== String(after[field] ?? ""))
    .map((field) => `${field}: ${formatAuditValue(before[field])} → ${formatAuditValue(after[field])}`);

  return changes.join("; ");
}
