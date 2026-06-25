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
];
function formatAuditValue(value) {
    if (value === null || value === undefined || value === "")
        return "—";
    return String(value);
}
export function describeFieldChanges(before, after, fields = DEFAULT_FIELDS) {
    const changes = fields
        .filter((field) => String(before[field] ?? "") !== String(after[field] ?? ""))
        .map((field) => `${field}: ${formatAuditValue(before[field])} → ${formatAuditValue(after[field])}`);
    return changes.join("; ");
}
