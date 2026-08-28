export declare function denylistJwt(jti: string, ttlMs: number): Promise<void>;
export declare function isJwtDenylisted(jti: string): Promise<boolean>;
