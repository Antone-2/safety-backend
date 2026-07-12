import { Queue, Worker } from "bullmq";
import { redisClient } from "./redis.client.js";
export function createQueue(name) {
    return new Queue(name, {
        connection: redisClient,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000,
            },
            removeOnComplete: {
                count: 1000,
                age: 24 * 3600,
            },
            removeOnFail: {
                count: 1000,
                age: 7 * 24 * 3600,
            },
        },
    });
}
export function createWorker(name, processor, concurrency = 1) {
    const worker = new Worker(name, processor, {
        connection: redisClient,
        concurrency,
    });
    worker.on("completed", (job) => {
        console.log(`[${name}] Job ${job.id} completed`);
    });
    worker.on("failed", (job, err) => {
        console.error(`[${name}] Job ${job?.id} failed:`, err.message);
    });
    return worker;
}
export const emailQueue = createQueue("email");
export const smsQueue = createQueue("sms");
export const fileProcessingQueue = createQueue("file-processing");
export const reportQueue = createQueue("report-generation");
export const slaQueue = createQueue("sla");
