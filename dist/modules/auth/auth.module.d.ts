export declare function hasMatchingDeviceFingerprint(sessions: Array<{
    device_fingerprint?: string;
    deviceFingerprint?: string;
}>, currentFingerprint: string): boolean;
export declare function createAuthRouter(): import("express-serve-static-core").Router;
