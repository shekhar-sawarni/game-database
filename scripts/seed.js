import 'dotenv/config';
import { redisClient } from '../src/config/redis.js';
import { LeaderboardManager } from '../src/services/leaderboardManager.js';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { RatingModel } from '../src/models/rating.js';
import { UserModel } from '../src/models/user.js';

async function main() {
  const mode = process.argv[2] || 'blitz';
  const lb = new LeaderboardManager(mode);
  console.log(`Seeding ${mode}...`);
  if (env.MONGO_URI) {
    await mongoose.connect(env.MONGO_URI);
  }
  for (let i = 1; i <= 1000; i++) {
    const rating = Math.floor(800 + Math.random() * 1600);
    const userId = String(1000 + i);
    const countryCode = i % 2 === 0 ? 'US' : 'IN';
    await lb.updateUserRating(userId, rating, { countryCode });
    if (env.MONGO_URI) {
      await UserModel.updateOne({ userId }, { $setOnInsert: { countryCode } }, { upsert: true });
      await RatingModel.updateOne({ userId, mode }, { $set: { rating } }, { upsert: true });
    }
  }
  console.log('Done.');
  redisClient.disconnect();
  if (env.MONGO_URI) await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

 
