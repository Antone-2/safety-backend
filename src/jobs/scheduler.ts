import { emailQueue, smsQueue, slaQueue, reportQueue, createWorker } from "../shared/infrastructure/redis/queue.service.js";
import { connectRedis } from "../shared/infrastructure/redis/redis.client.js";
import { logger } from "../shared/utils/logger.js";
import { sendEmail } from "./workers/index.js";
import { sendSms } from "./workers/index.js";
import { checkSla } from "./workers/index.js";
import { generateReport } from "./workers/index.js";

async function startWorkers() {
  try {
    await connectRedis();
    logger.info("Starting background workers...");

    createWorker("email", sendEmail, 10);
    createWorker("sms", sendSms, 5);
    createWorker("sla", checkSla, 5);
    createWorker("report", generateReport, 2);

    logger.info("Background workers started successfully");
  } catch (error) {
    logger.error({ err: error as Error }, "Failed to start workers:");
    process.exit(1);
  }
}

startWorkers();
