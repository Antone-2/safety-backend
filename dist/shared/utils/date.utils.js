import { getEnv } from "../../config/index.js";
const TIMEZONE = getEnv().TIMEZONE;
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
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
    const due = new Date(new Date(dueDate).toLocaleString("en-US", { timeZone: TIMEZONE }));
    return due < now;
}
export function toUtcIso(value) {
    if (!value)
        return new Date().toISOString();
    const text = String(value);
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime()))
        return new Date().toISOString();
    const localDate = new Date(parsed.toLocaleString("en-US", { timeZone: TIMEZONE }));
    const offset = localDate.getTime() - parsed.getTime();
    return new Date(parsed.getTime() - offset).toISOString();
}
