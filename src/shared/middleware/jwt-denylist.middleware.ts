import { redisClient } from "../infrastructure/redis/redis.client.js";

const DENYLIST_PREFIX = "jwt:denylist:";

export async function denylistJwt(jti: string, ttlMs: number) {
  if (!redisClient || redisClient.status !== "ready") return;
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  await redisClient.setex(`${DENYLIST_PREFIX}${jti}`, ttlSeconds, "1");
}

export async function isJwtDenylisted(jti: string): Promise<boolean> {
  if (!redisClient || redisClient.status !== "ready") return false;
  const value = await redisClient.get(`${DENYLIST_PREFIX}${jti}`);
  return value === "1";
}
