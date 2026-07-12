import { getDbClient } from "./postgres.client.js";

export class UnitOfWork {
  private client: Awaited<ReturnType<typeof getDbClient>>;

  constructor(client: Awaited<ReturnType<typeof getDbClient>>) {
    this.client = client;
  }

  async query(text: string, params?: any[]) {
    return this.client.query(text, params);
  }

  async commit() {
    await this.client.query("COMMIT");
  }

  async rollback() {
    try {
      await this.client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors
    }
  }
}

export async function withTransaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
  const client = await getDbClient();
  let uow: UnitOfWork | null = null;
  try {
    await client.query("BEGIN");
    uow = new UnitOfWork(client);
    const result = await fn(uow);
    await uow.commit();
    return result;
  } catch (error) {
    if (uow) await uow.rollback();
    throw error;
  } finally {
    client.release();
  }
}
