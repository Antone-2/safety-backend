export interface DomainEvent {
  type: string;
  timestamp: Date;
  actor?: { userId: string; email: string; role: string };
  payload: Record<string, unknown>;
}

export class IncidentCreatedEvent implements DomainEvent {
  type = "incident.created";
  timestamp = new Date();
  actor: DomainEvent["actor"];
  payload: Record<string, unknown>;

  constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]) {
    this.payload = payload;
    this.actor = actor;
  }
}

export class CapaAssignedEvent implements DomainEvent {
  type = "capa.assigned";
  timestamp = new Date();
  actor: DomainEvent["actor"];
  payload: Record<string, unknown>;

  constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]) {
    this.payload = payload;
    this.actor = actor;
  }
}

export class PermitApprovedEvent implements DomainEvent {
  type = "permit.approved";
  timestamp = new Date();
  actor: DomainEvent["actor"];
  payload: Record<string, unknown>;

  constructor(payload: Record<string, unknown>, actor?: DomainEvent["actor"]) {
    this.payload = payload;
    this.actor = actor;
  }
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on<T extends DomainEvent>(eventType: string, handler: EventHandler<T>) {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);
  }

  async emit(event: DomainEvent) {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}

export const eventBus = new EventBus();
