import { getDbClient } from "./postgres.client.js";
export class UnitOfWork {
    client;
    constructor(client) {
        this.client = client;
    }
    async query(text, params) {
        return this.client.query(text, params);
    }
    async commit() {
        await this.client.query("COMMIT");
    }
    async rollback() {
        try {
            await this.client.query("ROLLBACK");
        }
        catch {
            // Ignore rollback errors
        }
    }
}
export async function withTransaction(fn) {
    const client = await getDbClient();
    let uow = null;
    try {
        await client.query("BEGIN");
        uow = new UnitOfWork(client);
        const result = await fn(uow);
        await uow.commit();
        return result;
    }
    catch (error) {
        if (uow)
            await uow.rollback();
        throw error;
    }
    finally {
        client.release();
    }
}
