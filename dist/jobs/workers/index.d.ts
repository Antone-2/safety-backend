export declare function sendEmail(job: {
    data: {
        to: string;
        subject: string;
        html: string;
    };
}): Promise<void>;
export declare function sendSms(job: {
    data: {
        to: string;
        body: string;
    };
}): Promise<void>;
export declare function processImage(job: {
    data: {
        key: string;
    };
}): Promise<void>;
export declare function generateReport(job: {
    data: {
        type: string;
        params: unknown;
    };
}): Promise<void>;
export declare function checkSla(job: {
    data: {
        resourceType: string;
        resourceId: string;
        deadline: string;
        action: string;
    };
}): Promise<void>;
export declare function processFollowup(job: {
    data: {
        reportId?: string;
        stage?: string;
    };
}): Promise<void>;
