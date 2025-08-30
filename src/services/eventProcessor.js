import { LeaderboardManager } from './leaderboardManager.js';
import { redisClient } from '../config/redis.js';
import { RatingModel } from '../models/rating.js';
import { UserModel } from '../models/user.js';
import { GameResultModel } from '../models/gameResult.js';
import { getRedisForCountry } from '../config/redisShards.js';
import { getRatingModelForCountry, getGameResultModelForCountry } from '../models/factories.js';

export async function processGameResultEvent(payload) {
  const { mode, players, countryCode, region, event_id } = payload || {};
  if (!mode || !Array.isArray(players) || players.length !== 2) {
    throw new Error('Invalid payload');
  }
  if (event_id) {
    const idemKey = `event:idem:${String(event_id)}`;
    const already = await redisClient.set(idemKey, '1', 'NX', 'EX', env.EVENT_ID_TTL);
    if (already === null) {
      return { skipped: true };
    }
  }
  let countryClient = null;
  if (countryCode) countryClient = getRedisForCountry(countryCode);
  const lb = new LeaderboardManager(mode, countryClient || redisClient);
  const [p1, p2] = players;
  const old1 = Number((await redisClient.hget(`rating:${mode}`, String(p1.user_id))) || (await RatingModel.findOne({ userId: String(p1.user_id), mode }).lean())?.rating || 1500);
  const old2 = Number((await redisClient.hget(`rating:${mode}`, String(p2.user_id))) || (await RatingModel.findOne({ userId: String(p2.user_id), mode }).lean())?.rating || 1500);
  const s1 = Number(p1.score);
  const s2 = Number(p2.score);
  let out1 = 0, out2 = 0;
  if (s1 > s2) { out1 = 1; out2 = 0; } else if (s1 < s2) { out1 = 0; out2 = 1; } else { out1 = out2 = 0.5; }
  const expected1 = 1 / (1 + Math.pow(10, (old2 - old1) / 400));
  const expected2 = 1 / (1 + Math.pow(10, (old1 - old2) / 400));
  const new1 = old1 + 32 * (out1 - expected1);
  const new2 = old2 + 32 * (out2 - expected2);
  await lb.updateUserRating(String(p1.user_id), new1, { countryCode, region });
  await lb.updateUserRating(String(p2.user_id), new2, { countryCode, region });
  // persist ratings
  const Rating = countryCode ? getRatingModelForCountry(countryCode) : RatingModel;
  await Rating.updateOne(
    { userId: String(p1.user_id), mode },
    { $set: { rating: new1 } },
    { upsert: true }
  );
  await Rating.updateOne(
    { userId: String(p2.user_id), mode },
    { $set: { rating: new2 } },
    { upsert: true }
  );
  const GameResult = countryCode ? getGameResultModelForCountry(countryCode) : GameResultModel;
  await GameResult.create({
    mode,
    players: [
      { user_id: String(p1.user_id), score: Number(p1.score), old_rating: old1, new_rating: new1 },
      { user_id: String(p2.user_id), score: Number(p2.score), old_rating: old2, new_rating: new2 }
    ]
  });
  // Do not upsert User due to required fields
  return { updated: [
    { user_id: String(p1.user_id), rating: Math.round(new1) },
    { user_id: String(p2.user_id), rating: Math.round(new2) }
  ] };
}


