import { Pool } from "pg";
import type { AcknowledgeSafetyAlertInput, CreateSafetyAlertInput, SafetyAlertAcknowledgement, SafetyAlertRecord, SafetyAlertStats, UpdateSafetyAlertInput } from "./safety-alerts.types.js";
export declare class SafetyAlertsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<SafetyAlertRecord[]>;
    findById(id: string): Promise<SafetyAlertRecord | null>;
    create(data: CreateSafetyAlertInput): Promise<SafetyAlertRecord>;
    update(id: string, data: UpdateSafetyAlertInput): Promise<SafetyAlertRecord | null>;
    delete(id: string): Promise<boolean>;
    acknowledge(alertId: string, input: AcknowledgeSafetyAlertInput): Promise<SafetyAlertAcknowledgement>;
    getAcknowledgements(alertId: string): Promise<SafetyAlertAcknowledgement[]>;
    getPendingAcknowledgements(userId: string): Promise<SafetyAlertRecord[]>;
    getStats(): Promise<SafetyAlertStats>;
}
