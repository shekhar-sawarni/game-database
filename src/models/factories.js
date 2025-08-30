import mongoose from 'mongoose';
import { getMongooseForCountry, getResultsMongooseForCountry } from '../config/mongoShards.js';
import { RatingSchema, GameResultSchema } from './schemas.js';

export function getRatingModelForCountry(countryCode) {
  const conn = getMongooseForCountry(countryCode);
  if (!conn) return mongoose.models.Rating || mongoose.model('Rating', RatingSchema);
  return conn.models.Rating || conn.model('Rating', RatingSchema);
}

export function getGameResultModelForCountry(countryCode) {
  const conn = getResultsMongooseForCountry(countryCode);
  if (!conn) return mongoose.models.GameResult || mongoose.model('GameResult', GameResultSchema);
  return conn.models.GameResult || conn.model('GameResult', GameResultSchema);
}


