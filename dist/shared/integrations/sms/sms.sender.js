import twilio from "twilio";
import { getEnv } from "../../../config/index.js";
export class TwilioSmsSender {
    client = twilio(getEnv().TWILIO_SID, getEnv().TWILIO_AUTH_TOKEN);
    async send(to, body) {
        try {
            await this.client.messages.create({
                body,
                from: getEnv().TWILIO_FROM,
                to,
            });
            return true;
        }
        catch (error) {
            console.error("SMS send failed:", error);
            return false;
        }
    }
}
export class NoopSmsSender {
    async send(_to, body) {
        console.log(`[Noop SMS] To: ${_to}, Body: ${body}`);
        return false;
    }
}
export function getSmsSender() {
    const env = getEnv();
    if (env.TWILIO_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
        return new TwilioSmsSender();
    }
    return new NoopSmsSender();
}
