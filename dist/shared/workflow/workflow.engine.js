import { BusinessRuleError } from "../domain/errors/index.js";
export class WorkflowEngine {
    definition;
    constructor(definition) {
        this.definition = definition;
    }
    get name() {
        return this.definition.name;
    }
    get initialState() {
        return this.definition.initialState;
    }
    canTransition(currentState, event, actor) {
        const transition = this.findTransition(currentState, event);
        if (!transition)
            return false;
        if (!transition.requiredPermission)
            return true;
        return (actor?.permissions?.includes("*") === true ||
            actor?.permissions?.includes(transition.requiredPermission) === true);
    }
    transition(currentState, event, actor) {
        const transition = this.findTransition(currentState, event);
        if (!transition) {
            throw new BusinessRuleError(`Invalid workflow transition: ${currentState} -> ${event}`);
        }
        if (!this.canTransition(currentState, event, actor)) {
            throw new BusinessRuleError(`Actor cannot perform workflow transition: ${event}`);
        }
        return transition.to;
    }
    isFinal(state) {
        return this.definition.finalStates.includes(state);
    }
    findTransition(currentState, event) {
        return this.definition.transitions.find((transition) => transition.from === currentState && transition.event === event);
    }
}
export const INCIDENT_WORKFLOW = {
    name: "incident",
    initialState: "Open",
    finalStates: ["Closed"],
    transitions: [
        {
            from: "Open",
            event: "start-investigation",
            to: "Investigating",
            requiredPermission: "incidents:update",
        },
        {
            from: "Investigating",
            event: "submit-root-cause",
            to: "Root Cause Analysis",
            requiredPermission: "incidents:update",
        },
        {
            from: "Root Cause Analysis",
            event: "open-capa",
            to: "CAPA Open",
            requiredPermission: "capa:create",
        },
        {
            from: "CAPA Open",
            event: "close",
            to: "Closed",
            requiredPermission: "capa:verify",
        },
    ],
};
export const REPORT_WORKFLOW = {
    name: "report",
    initialState: "Open",
    finalStates: ["Closed"],
    transitions: [
        {
            from: "Open",
            event: "assign",
            to: "Assigned",
            requiredPermission: "reports:assign",
        },
        {
            from: "Open",
            event: "start",
            to: "In Progress",
            requiredPermission: "reports:update",
        },
        {
            from: "Assigned",
            event: "start",
            to: "In Progress",
            requiredPermission: "reports:update",
        },
        {
            from: "In Progress",
            event: "close",
            to: "Closed",
            requiredPermission: "reports:update",
        },
        {
            from: "Assigned",
            event: "close",
            to: "Closed",
            requiredPermission: "reports:update",
        },
    ],
};
export const PERMIT_WORKFLOW = {
    name: "permit",
    initialState: "draft",
    finalStates: ["closed", "rejected"],
    transitions: [
        {
            from: "draft",
            event: "submit",
            to: "supervisor_review",
            requiredPermission: "permits:create",
        },
        {
            from: "supervisor_review",
            event: "approve",
            to: "ehs_review",
            requiredPermission: "permits:approve",
        },
        {
            from: "ehs_review",
            event: "approve",
            to: "issuer_review",
            requiredPermission: "permits:approve",
        },
        {
            from: "issuer_review",
            event: "issue",
            to: "active",
            requiredPermission: "permits:approve",
        },
        {
            from: "active",
            event: "close",
            to: "closed",
            requiredPermission: "permits:update",
        },
        {
            from: "supervisor_review",
            event: "reject",
            to: "rejected",
            requiredPermission: "permits:approve",
        },
        {
            from: "ehs_review",
            event: "reject",
            to: "rejected",
            requiredPermission: "permits:approve",
        },
        {
            from: "issuer_review",
            event: "reject",
            to: "rejected",
            requiredPermission: "permits:approve",
        },
    ],
};
