type Calendar = {
    workingDays?: number[];
    startHour?: number;
    endHour?: number;
    holidays?: string[];
    timezone?: string;
};
export declare function addBusinessHours(start: Date, hours: number, calendar?: Calendar): Date;
export declare class AssignmentSlaService {
    applyPolicy(assignmentId: string): Promise<any>;
    processDue(limit?: number): Promise<{
        assignmentId: any;
        level: number;
        recipients: number;
    }[]>;
    private escalate;
    private notify;
}
export declare const assignmentSlaService: AssignmentSlaService;
export declare function startAssignmentSlaScheduler(): NodeJS.Timeout;
export {};
