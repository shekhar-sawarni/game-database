import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectMongo() {
  if (!env.MONGO_URI) {
    console.warn('MONGO_URI not provided. Skipping MongoDB connection.');
    return;
  }
  try {
    await mongoose.connect(env.MONGO_URI, {
      autoIndex: true
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}


