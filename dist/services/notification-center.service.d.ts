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
        attempts: number;
        nextAttemptAt: string | null;
    }[]>;
    processJob(jobId: string): Promise<{
        jobId: string;
        status: string;
        delivered: number;
        failed: number;
        attempts: number;
        nextAttemptAt: string | null;
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
        channels: any;
        id: string;
        userId: string | null;
        recipient: string;
        cadence: string;
        active: number;
        nextRunAt: null;
        createdAt: string;
        updatedAt: string;
    }>;
    private deliver;
}
export declare const notificationCenterService: NotificationCenterService;
