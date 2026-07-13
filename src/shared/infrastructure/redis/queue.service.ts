import { Queue, Worker, type Job } from "bullmq";
import { getEnv } from "../../../config/index.js";

const redisUrl = getEnv().REDIS_URL;
const bullConnection = redisUrl ? redisConnectionOptions(redisUrl) : undefined;

function redisConnectionOptions(value: string) {
  const url = new URL(value);
  const database = Number(url.pathname.replace("/", "") || 0);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isFinite(database) ? database : 0,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export interface JobData {
  [key: string]: unknown;
}

export function createQueue<T extends JobData = JobData>(name: string) {
  if (!bullConnection) {
    throw new Error(`REDIS_URL is required to create the ${name} queue`);
  }
  return new Queue<T>(name, {
    connection: bullConnection,
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

export function createWorker<T extends JobData = JobData>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 1
) {
  if (!bullConnection) {
    throw new Error(`REDIS_URL is required to create the ${name} worker`);
  }
  const worker = new Worker<T>(name, processor, {
    connection: bullConnection,
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

export const emailQueue = createQueue<{ to: string; subject: string; html: string }>("email");
export const smsQueue = createQueue<{ to: string; body: string }>("sms");
export const fileProcessingQueue = createQueue<{ key: string }>("file-processing");
export const reportQueue = createQueue<{ type: string; params: unknown }>("report-generation");
export const slaQueue = createQueue<{ resourceType: string; resourceId: string; deadline: string; action: string }>("sla");
