import type { Pool } from "pg";
export type MFASetupChallenge = {
    secret: string;
    qrCode: string;
};
export type MFARecoveryCode = {
    code: string;
};
export declare class MFAService {
    private pool;
    constructor(pool?: Pool);
    generateSecret(email: string): MFASetupChallenge;
    generateRecoveryCodes(count?: number): MFARecoveryCode[];
    createMFAEnrollment(userId: string, secret: string, recoveryCodesRaw: string[]): Promise<void>;
    verifyMFAEnrollment(userId: string, token: string): Promise<boolean>;
    verifyTOTPToken(userId: string, token: string): Promise<boolean>;
    verifyRecoveryCode(userId: string, code: string): Promise<boolean>;
    isMFAEnabled(userId: string): Promise<boolean>;
    disableMFA(userId: string): Promise<void>;
}
export declare const mfaService: MFAService;
