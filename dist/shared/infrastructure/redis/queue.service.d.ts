import { Queue, Worker, type Job } from "bullmq";
export interface JobData {
    [key: string]: unknown;
}
export declare function createQueue<T extends JobData = JobData>(name: string): Queue<T, any, string, T extends Job<infer D, any, any> ? D : T, T extends Job<any, infer R, any> ? R : any, T extends Job<any, any, infer N extends string> ? N : string>;
export declare function createWorker<T extends JobData = JobData>(name: string, processor: (job: Job<T>) => Promise<void>, concurrency?: number): Worker<T, any, string>;
export declare function getBullMqUnavailableMessage(): string;
export declare function getQueueStats(): Promise<{
    available: boolean;
    reason: string;
    queues: never[];
    redis?: undefined;
} | {
    available: boolean;
    redis: {
        host: string;
        port: number;
    };
    queues: Record<string, any>;
    reason?: undefined;
}>;
