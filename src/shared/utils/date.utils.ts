import { getEnv } from "../../config/index.js";

const TIMEZONE = getEnv().TIMEZONE;

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function isOverdue(dueDate: string): boolean {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
  const due = new Date(new Date(dueDate).toLocaleString("en-US", { timeZone: TIMEZONE }));
  return due < now;
}

export function toUtcIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const text = String(value);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  const localDate = new Date(parsed.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const offset = localDate.getTime() - parsed.getTime();
  return new Date(parsed.getTime() - offset).toISOString();
}
