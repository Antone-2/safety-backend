import { createWorker, createQueue } from "../shared/infrastructure/redis/queue.service.js";
import { connectRedis, supportsBullMq } from "../shared/infrastructure/redis/redis.client.js";
import { logger } from "../shared/utils/logger.js";
import { sendEmail } from "./workers/index.js";
import { sendSms } from "./workers/index.js";
import { checkSla } from "./workers/index.js";
import { generateReport } from "./workers/index.js";
import { processFollowup } from "./workers/index.js";
async function startWorkers() {
    try {
        const redisReady = await connectRedis();
        if (!redisReady) {
            logger.warn("Redis not configured; skipping background workers.");
            return;
        }
        const bullMqReady = await supportsBullMq();
        if (!bullMqReady) {
            logger.warn("Redis version is too old for BullMQ; skipping background workers.");
            return;
        }
        logger.info("Starting background workers...");
        createWorker("email", sendEmail, 10);
        createWorker("sms", sendSms, 5);
        createWorker("sla", checkSla, 5);
        createWorker("report", generateReport, 2);
        createWorker("followup", processFollowup, 2);
        const followupQueue = createQueue("followup");
        await followupQueue.add("process-followup-batch", { reportId: "", stage: "" }, {
            repeat: { every: 60 * 60 * 1000 },
            removeOnComplete: true,
            removeOnFail: false,
        });
        logger.info("Background workers started successfully");
    }
    catch (error) {
        logger.error({ err: error }, "Failed to start workers:");
        process.exit(1);
    }
}
startWorkers();
