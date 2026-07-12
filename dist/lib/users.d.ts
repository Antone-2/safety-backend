export interface AppUser {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
}
export declare const SUPERVISOR_ROLES: string[];
export declare function listUsers(roleFilter?: string[]): Promise<AppUser[]>;
export declare function findUserByIdentifier(identifier: string): Promise<AppUser | null>;
