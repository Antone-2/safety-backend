export class IncidentCreatedEvent {
    type = "incident.created";
    timestamp = new Date();
    actor;
    payload;
    constructor(payload, actor) {
        this.payload = payload;
        this.actor = actor;
    }
}
export class CapaAssignedEvent {
    type = "capa.assigned";
    timestamp = new Date();
    actor;
    payload;
    constructor(payload, actor) {
        this.payload = payload;
        this.actor = actor;
    }
}
export class PermitApprovedEvent {
    type = "permit.approved";
    timestamp = new Date();
    actor;
    payload;
    constructor(payload, actor) {
        this.payload = payload;
        this.actor = actor;
    }
}
class EventBus {
    handlers = new Map();
    on(eventType, handler) {
        const handlers = this.handlers.get(eventType) || [];
        handlers.push(handler);
        this.handlers.set(eventType, handlers);
    }
    async emit(event) {
        const handlers = this.handlers.get(event.type) || [];
        await Promise.all(handlers.map((handler) => handler(event)));
    }
}
export const eventBus = new EventBus();
