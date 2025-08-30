import { redisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { LeaderboardManager } from './leaderboardManager.js';

export function startSnapshotScheduler(mode, intervalMs = 60_000, k = 100) {
  const lb = new LeaderboardManager(mode);
  const timer = setInterval(async () => {
    try {
      const top = await redisClient.zrevrange(lb.topKKey, 0, k - 1, 'WITHSCORES');
      if (!top || top.length === 0) return;
      const now = new Date();
      const ts = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
      const snapKey = `lb:${mode}:snap:${ts}`;
      const mapping = {};
      for (let i = 0; i < top.length; i += 2) {
        mapping[top[i]] = Number(top[i + 1]);
      }
      await redisClient.zadd(snapKey, ...Object.entries(mapping).flatMap(([m, s]) => [s, m]));
      // Optionally expire snapshots later or keep for history
    } catch (err) {
      console.error('Snapshot error:', err.message);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}


