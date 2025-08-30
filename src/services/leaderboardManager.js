import { redisClient } from '../config/redis.js';
import { env } from '../config/env.js';

export class LeaderboardManager {
  constructor(mode, client) {
    this.mode = mode;
    this.client = client || redisClient;
    this.numShards = env.NUM_SHARDS;
    this.globalShards = Array.from({ length: this.numShards }, (_, i) => `lb:${mode}:global:${i}`);
    this.topKKey = `lb:${mode}:topK`;
    this.dailyKeyPrefix = `lb:${mode}:day:`;
    this.countryPrefix = `lb:${mode}:country:`;
    this.regionPrefix = `lb:${mode}:region:`;
    this.aggregatedGlobalKey = `lb:${mode}:global:agg`;
  }

  getShard(userId) {
    const idNum = Number(userId);
    if (Number.isFinite(idNum)) return idNum % this.numShards;
    // fallback: simple hash of string
    let hash = 0;
    for (let i = 0; i < String(userId).length; i++) {
      hash = (hash * 31 + String(userId).charCodeAt(i)) >>> 0;
    }
    return hash % this.numShards;
  }

  async updateUserRating(userId, newRating, options = {}) {
    const { countryCode, region } = options;
    const pipe = this.client.multi();
    // 1) Update rating HASH
    pipe.hset(`rating:${this.mode}`, String(userId), Number(newRating));
    // 2) Update global shard
    const shardIdx = this.getShard(userId);
    pipe.zadd(this.globalShards[shardIdx], Number(newRating), String(userId));
    // 3) Update top-K cache and trim
    pipe.zadd(this.topKKey, Number(newRating), String(userId));
    pipe.zremrangebyrank(this.topKKey, 0, -(env.TOP_K + 1));
    // 4) Update daily leaderboard with TTL
    const now = new Date();
    const YYYY = now.getUTCFullYear();
    const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(now.getUTCDate()).padStart(2, '0');
    const dailyKey = `${this.dailyKeyPrefix}${YYYY}${MM}${DD}`;
    pipe.zadd(dailyKey, Number(newRating), String(userId));
    pipe.expire(dailyKey, env.DAILY_TTL_SECONDS);
    // 5) Optional: country and region leaderboards
    if (countryCode) pipe.zadd(`${this.countryPrefix}${countryCode}`, Number(newRating), String(userId));
    if (region) pipe.zadd(`${this.regionPrefix}${region}`, Number(newRating), String(userId));
    await pipe.exec();
  }

  async getUserRank(userId, options = {}) {
    const { countryCode, region } = options;
    const ratingStr = await this.client.hget(`rating:${this.mode}`, String(userId));
    if (ratingStr == null) return null;
    const userScore = Number(ratingStr);
    // Region/country specific: count in single sorted set
    if (region) {
      const key = `${this.regionPrefix}${region}`;
      const higher = Number((await this.client.zcount(key, `(${userScore}`, '+inf')) || 0);
      return higher + 1;
    }
    if (countryCode) {
      const key = `${this.countryPrefix}${countryCode}`;
      const higher = Number((await this.client.zcount(key, `(${userScore}`, '+inf')) || 0);
      return higher + 1;
    }
    // Global: aggregate across shards
    const pipe = this.client.multi();
    for (const shardKey of this.globalShards) {
      pipe.zcount(shardKey, `(${userScore}`, '+inf');
    }
    const results = await pipe.exec();
    const higherCounts = results.map(([, val]) => Number(val) || 0);
    return higherCounts.reduce((a, b) => a + b, 0) + 1;
  }

  async getTopK(k = 100, options = {}) {
    const { countryCode, region, start = 0 } = options;
    let key = this.topKKey;
    if (!countryCode && !region && env.AGGREGATOR_ENABLED) key = this.aggregatedGlobalKey;
    if (region) key = `${this.regionPrefix}${region}`;
    else if (countryCode) key = `${this.countryPrefix}${countryCode}`;
    const end = start + k - 1;
    const entries = await this.client.zrevrange(key, start, end, 'WITHSCORES');
    const out = [];
    for (let i = 0; i < entries.length; i += 2) {
      out.push({ userId: entries[i], score: Number(entries[i + 1]) });
    }
    return out;
  }
}


