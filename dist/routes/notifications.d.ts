declare const router: import("express-serve-static-core").Router;
export interface NotificationSummary {
    id: string;
    reportId: string;
    channel: string;
    recipient: string;
    subject: string;
    message: string;
    delivered: boolean;
    read: boolean;
    createdAt: string;
}
export declare function listNotifications(): Promise<NotificationSummary[]>;
export declare function markNotificationsRead(ids: string[]): Promise<void>;
export default router;
