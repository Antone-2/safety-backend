export type NotificationChannel = "email" | "sms" | "whatsapp" | "in-app";
export type NotificationRecipient = {
    channel: NotificationChannel;
    recipient: string;
    name?: string;
};
export declare class NotificationCenterService {
    listTemplates(): Promise<any[]>;
    upsertTemplate(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<any>;
    enqueue(input: {
        eventKey: string;
        workflow?: string;
        resourceType?: string;
        resourceId?: string;
        payload?: Record<string, unknown>;
        recipients: NotificationRecipient[];
        createdBy?: string;
        maxAttempts?: number;
    }): Promise<any>;
    processDue(limit?: number): Promise<{
        jobId: string;
        status: string;
        delivered: number;
        failed: number;
        attempts: any;
        nextAttemptAt: Date | null;
    }[]>;
    processJob(jobId: string): Promise<{
        jobId: string;
        status: string;
        delivered: number;
        failed: number;
        attempts: any;
        nextAttemptAt: Date | null;
    }>;
    listJobs(filters?: {
        status?: string;
        limit?: number;
    }): Promise<any[]>;
    listRecipients(jobId?: string): Promise<any[]>;
    dashboard(): Promise<{
        jobs: any[];
        recipients: any[];
        failures: any[];
    }>;
    createDigest(input: {
        recipient: string;
        userId?: string;
        cadence?: string;
        channels?: NotificationChannel[];
    }): Promise<{
        id: any;
        userId: any;
        recipient: any;
        cadence: any;
        channels: any;
        active: any;
        nextRunAt: any;
        createdAt: any;
        updatedAt: any;
    }>;
    private deliver;
}
export declare const notificationCenterService: NotificationCenterService;
