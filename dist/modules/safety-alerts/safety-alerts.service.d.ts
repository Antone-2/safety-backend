import { SafetyAlertsRepository } from "./safety-alerts.repository.js";
import type { AcknowledgeSafetyAlertInput, CreateSafetyAlertInput, UpdateSafetyAlertInput } from "./safety-alerts.types.js";
export declare class SafetyAlertsService {
    private repository;
    constructor(repository: SafetyAlertsRepository);
    getAlerts(filters?: Record<string, unknown>): Promise<import("./safety-alerts.types.js").SafetyAlertRecord[]>;
    getById(id: string): Promise<import("./safety-alerts.types.js").SafetyAlertRecord | null>;
    create(data: CreateSafetyAlertInput): Promise<import("./safety-alerts.types.js").SafetyAlertRecord>;
    update(id: string, data: UpdateSafetyAlertInput): Promise<import("./safety-alerts.types.js").SafetyAlertRecord>;
    delete(id: string): Promise<true>;
    acknowledge(alertId: string, input: AcknowledgeSafetyAlertInput): Promise<import("./safety-alerts.types.js").SafetyAlertAcknowledgement>;
    getAcknowledgements(alertId: string): Promise<import("./safety-alerts.types.js").SafetyAlertAcknowledgement[]>;
    getPendingAcknowledgements(userId: string): Promise<import("./safety-alerts.types.js").SafetyAlertRecord[]>;
    getStats(): Promise<import("./safety-alerts.types.js").SafetyAlertStats>;
}
