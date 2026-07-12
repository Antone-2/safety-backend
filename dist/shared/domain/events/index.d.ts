export interface DomainEvent {
    type: string;
    timestamp: Date;
    actor?: {
        userId: string;
        email: string;
        role: string;
    };
    payload: Record<string, unknown>;
}
export declare class IncidentCreatedEvent implements DomainEvent {
    type: string;
    timestamp: Date;
    actor: DomainEvent["actor"];
    payload: Record<string, unknown>;
    constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]);
}
export declare class CapaAssignedEvent implements DomainEvent {
    type: string;
    timestamp: Date;
    actor: DomainEvent["actor"];
    payload: Record<string, unknown>;
    constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]);
}
export declare class PermitApprovedEvent implements DomainEvent {
    type: string;
    timestamp: Date;
    actor: DomainEvent["actor"];
    payload: Record<string, unknown>;
    constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]);
}
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;
declare class EventBus {
    private handlers;
    on<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void;
    emit(event: DomainEvent): Promise<void>;
}
export declare const eventBus: EventBus;
export {};
