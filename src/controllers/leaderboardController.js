import { LeaderboardManager } from '../services/leaderboardManager.js';
import { redisClient } from '../config/redis.js';
import { RatingModel } from '../models/rating.js';
import { UserModel } from '../models/user.js';
import { GameResultModel } from '../models/gameResult.js';
import { env } from '../config/env.js';
import { processGameResultEvent } from '../services/eventProcessor.js';
import { getRedisForCountry } from '../config/redisShards.js';
import { getRatingModelForCountry } from '../models/factories.js';
import { counters } from '../services/metrics.js';

export async function getLeaderboard(req, res) {
  try {
    const { mode } = req.params;
    const { countryCode, region } = req.query || {};
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '100', 10), 1), 1000);
    const offset = Math.max(parseInt(req.query?.offset || '0', 10), 0);
    const client = env.SHARD_BY_COUNTRY && countryCode ? (getRedisForCountry(countryCode) || redisClient) : redisClient;
    const lb = new LeaderboardManager(mode, client);
    const top = await lb.getTopK(limit, { countryCode, region, start: offset });
    const payload = top.map(e => ({ user_id: e.userId, score: Math.round(e.score) }));
    counters.game_events_total.inc({ type: 'get_leaderboard' });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRank(req, res) {
  try {
    const { mode, userId } = req.params;
    const { countryCode, region } = req.query || {};
    const client = env.SHARD_BY_COUNTRY && countryCode ? (getRedisForCountry(countryCode) || redisClient) : redisClient;
    const lb = new LeaderboardManager(mode, client);
    const rank = await lb.getUserRank(userId, { countryCode, region });
    if (rank == null) return res.status(404).json({ error: 'User not found' });
    const scoreStr = await redisClient.hget(`rating:${mode}`, String(userId));
    const score = Number(scoreStr || 0);
    counters.game_events_total.inc({ type: 'get_rank' });
    res.json({ user_id: String(userId), rank, score: Math.round(score) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRating(req, res) {
  try {
    const { mode, userId } = req.params;
    let ratingStr = await redisClient.hget(`rating:${mode}`, String(userId));
    if (ratingStr == null) {
      const { countryCode } = req.query || {};
      const Rating = countryCode ? getRatingModelForCountry(countryCode) : RatingModel;
      const doc = await Rating.findOne({ userId: String(userId), mode }).lean();
      if (!doc) return res.status(404).json({ error: 'User not found' });
      ratingStr = String(doc.rating);
    }
    res.json({ user_id: String(userId), rating: Math.round(Number(ratingStr)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Event intake endpoint for game results
export async function postGameResult(req, res) {
  try {
    const { mode, players, countryCode, region, event_id } = req.body || {};
    if (!mode || !Array.isArray(players) || players.length !== 2) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (env.EVENT_QUEUE_ENABLED) {
      const id = await redisClient.xadd(env.EVENT_STREAM_KEY, 'MAXLEN', '~', String(env.EVENT_MAXLEN), '*', 'type', 'game_result', 'payload', JSON.stringify({ mode, players, countryCode, region, event_id }));
      counters.game_events_total.inc({ type: 'enqueued_game_result' });
      return res.json({ enqueued: true, id });
    }
    const result = await processGameResultEvent({ mode, players, countryCode, region, event_id });
    counters.game_events_total.inc({ type: 'processed_game_result' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


