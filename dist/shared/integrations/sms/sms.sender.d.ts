export interface ISmsSender {
    send(to: string, body: string): Promise<boolean>;
}
export declare class TwilioSmsSender implements ISmsSender {
    private client;
    send(to: string, body: string): Promise<boolean>;
}
export declare class NoopSmsSender implements ISmsSender {
    send(_to: string, body: string): Promise<boolean>;
}
export declare function getSmsSender(): ISmsSender;
