export declare function seedAdminUsers(db: any): Promise<void>;
export declare function runMigrations(db: any): Promise<void>;
export declare function ensureSchema(db: any): Promise<void>;
export declare function addMigration(name: string, sql: string): void;
