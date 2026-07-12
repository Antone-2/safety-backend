import { getDbClient } from "./postgres.client.js";
export declare class UnitOfWork {
    private client;
    constructor(client: Awaited<ReturnType<typeof getDbClient>>);
    query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
export declare function withTransaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T>;
