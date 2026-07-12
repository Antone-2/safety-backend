import { Queue, Worker, type Job } from "bullmq";
export interface JobData {
    [key: string]: unknown;
}
export declare function createQueue<T extends JobData = JobData>(name: string): Queue<T, any, string, T extends Job<infer D, any, any> ? D : T, T extends Job<any, infer R, any> ? R : any, T extends Job<any, any, infer N extends string> ? N : string>;
export declare function createWorker<T extends JobData = JobData>(name: string, processor: (job: Job<T>) => Promise<void>, concurrency?: number): Worker<T, any, string>;
export declare const emailQueue: Queue<{
    to: string;
    subject: string;
    html: string;
}, any, string, {
    to: string;
    subject: string;
    html: string;
}, any, string>;
export declare const smsQueue: Queue<{
    to: string;
    body: string;
}, any, string, {
    to: string;
    body: string;
}, any, string>;
export declare const fileProcessingQueue: Queue<{
    key: string;
}, any, string, {
    key: string;
}, any, string>;
export declare const reportQueue: Queue<{
    type: string;
    params: unknown;
}, any, string, {
    type: string;
    params: unknown;
}, any, string>;
export declare const slaQueue: Queue<{
    resourceType: string;
    resourceId: string;
    deadline: string;
    action: string;
}, any, string, {
    resourceType: string;
    resourceId: string;
    deadline: string;
    action: string;
}, any, string>;
