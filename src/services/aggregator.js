import { redisClient } from '../config/redis.js';
import { getRedisForCountry, listShardCountries } from '../config/redisShards.js';
import { env } from '../config/env.js';

export async function aggregateCountryTopK(mode) {
  const countries = listShardCountries();
  const k = env.AGGREGATOR_TOP_K;
  const tempKeys = [];
  for (const cc of countries) {
    const client = getRedisForCountry(cc);
    if (!client) continue;
    const key = `lb:${mode}:topK`;
    const entries = await client.zrevrange(key, 0, k - 1, 'WITHSCORES');
    if (!entries || entries.length === 0) continue;
    const tempKey = `agg:${mode}:${cc}:${Date.now()}`;
    tempKeys.push(tempKey);
    const mapping = {};
    for (let i = 0; i < entries.length; i += 2) mapping[entries[i]] = Number(entries[i + 1]);
    await redisClient.zadd(tempKey, ...Object.entries(mapping).flatMap(([m, s]) => [s, `${cc}:${m}`]));
    await redisClient.expire(tempKey, 300);
  }
  if (tempKeys.length === 0) return;
  const dest = `lb:${mode}:global:agg`;
  await redisClient.zunionstore(dest, tempKeys.length, ...tempKeys);
  await redisClient.zremrangebyrank(dest, 0, -(env.AGGREGATOR_TOP_K + 1));
  // Fanout aggregated Top-K back to each shard (optional)
  const entries = await redisClient.zrevrange(dest, 0, k - 1, 'WITHSCORES');
  for (const cc of countries) {
    const client = getRedisForCountry(cc);
    if (!client) continue;
    const mapping = {};
    for (let i = 0; i < entries.length; i += 2) mapping[entries[i]] = Number(entries[i + 1]);
    const key = `lb:${mode}:global:agg`; // same key name across shards
    if (Object.keys(mapping).length) {
      await client.del(key);
      await client.zadd(key, ...Object.entries(mapping).flatMap(([m, s]) => [s, m]));
    }
  }
}


