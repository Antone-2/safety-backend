import type { IEmailTransport } from "./transporter.js";
export declare class SmtpEmailTransport implements IEmailTransport {
    send(to: string, subject: string, html: string): Promise<void>;
    sendBulk(to: string[], subject: string, html: string): Promise<void>;
}
export declare class BrevoEmailTransport implements IEmailTransport {
    send(to: string, subject: string, html: string): Promise<void>;
    sendBulk(to: string[], subject: string, html: string): Promise<void>;
}
export declare class EtherealEmailTransport implements IEmailTransport {
    send(to: string, subject: string, html: string): Promise<void>;
    sendBulk(_to: string[], _subject: string, _html: string): Promise<void>;
}
export declare function getEmailTransport(): IEmailTransport;
export declare const emailTransport: IEmailTransport;
