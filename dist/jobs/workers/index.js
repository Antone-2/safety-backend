export async function sendEmail(job) {
    const { to, subject, html } = job.data;
    const { emailTransport } = await import("../../shared/integrations/email/email.sender.js");
    await emailTransport.send(to, subject, html);
}
export async function sendSms(job) {
    const { to, body } = job.data;
    const { getSmsSender } = await import("../../shared/integrations/sms/sms.sender.js");
    const sender = getSmsSender();
    await sender.send(to, body);
}
export async function processImage(job) {
    const { key } = job.data;
    const { s3Client } = await import("../../shared/infrastructure/storage/s3.service.js");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { imageProcessor } = await import("../../shared/infrastructure/storage/image.processor.js");
    const { getEnv } = await import("../../config/index.js");
    const bucket = getEnv().S3_BUCKET || "safety-uploads";
    const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    if (Body) {
        for await (const chunk of Body) {
            chunks.push(chunk);
        }
    }
    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
    const imageSet = await imageProcessor.process(key, buffer);
    console.log(`Processed image ${key}:`, imageSet);
}
export async function generateReport(job) {
    const { type, params } = job.data;
    console.log(`Generating report: ${type}`, params);
}
export async function checkSla(job) {
    const { resourceType, resourceId, deadline, action } = job.data;
    console.log(`SLA check for ${resourceType}/${resourceId}: ${action}`);
}
