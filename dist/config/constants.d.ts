export declare const APP_NAME = "Crown Safety Backend";
export declare const APP_VERSION = "2.0.0";
export declare const API_PREFIX = "/api/v1";
export declare const JWT: {
    readonly ACCESS_EXPIRES: "15m";
    readonly REFRESH_EXPIRES: "7d";
};
export declare const RATE_LIMIT: {
    readonly WINDOW_MS: number;
    readonly MAX_REQUESTS: number;
    readonly SKIP_LOCALHOST: boolean;
};
export declare const FILE_UPLOAD: {
    readonly MAX_SIZE: number;
    readonly ALLOWED_TYPES: readonly ["application/pdf", "image/*", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    readonly URL_EXPIRY: 300;
};
export declare const IMAGE_PROCESSING: {
    readonly MAX_WIDTH: 1920;
    readonly QUALITY: 80;
    readonly THUMB_SIZES: readonly [200, 400, 800];
};
export declare const QUEUES: {
    readonly EMAIL_CONCURRENCY: 10;
    readonly SMS_CONCURRENCY: 5;
    readonly FILE_CONCURRENCY: 3;
    readonly REPORT_CONCURRENCY: 2;
};
