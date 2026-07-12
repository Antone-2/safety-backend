export function formatDate(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString();
}
export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
export function addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
}
export function isOverdue(dueDate) {
    return new Date(dueDate) < new Date();
}
