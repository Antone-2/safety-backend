export type WorkflowTransition = {
    from: string;
    event: string;
    to: string;
    requiredPermission?: string;
};
export type WorkflowDefinition = {
    name: string;
    initialState: string;
    finalStates: string[];
    transitions: WorkflowTransition[];
};
export type WorkflowActor = {
    id?: string;
    role: string;
    permissions?: string[];
};
export declare class WorkflowEngine {
    private definition;
    constructor(definition: WorkflowDefinition);
    get name(): string;
    get initialState(): string;
    canTransition(currentState: string, event: string, actor?: WorkflowActor): boolean;
    transition(currentState: string, event: string, actor?: WorkflowActor): string;
    isFinal(state: string): boolean;
    private findTransition;
}
export declare const INCIDENT_WORKFLOW: WorkflowDefinition;
export declare const REPORT_WORKFLOW: WorkflowDefinition;
export declare const PERMIT_WORKFLOW: WorkflowDefinition;
