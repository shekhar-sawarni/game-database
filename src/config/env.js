import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  PORT: parseInt(process.env.PORT || '8000', 10),
  REDIS_MOCK: String(process.env.REDIS_MOCK || '').toLowerCase() === 'true',
  REDIS_URL: process.env.REDIS_URL || undefined,
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_USERNAME: process.env.REDIS_USERNAME || undefined,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_TLS: String(process.env.REDIS_TLS || '').toLowerCase() === 'true',
  MONGO_URI: process.env.MONGO_URI || process.env.MONGO_USERS_URI || process.env.MONGO_RESULTS_URI || '',
  NUM_SHARDS: parseInt(process.env.NUM_SHARDS || '10', 10),
  TOP_K: parseInt(process.env.TOP_K || '1000', 10),
  DAILY_TTL_SECONDS: parseInt(process.env.DAILY_TTL_SECONDS || '86400', 10),
  AUTH_ACCESS_TOKEN_SECRET: process.env.AUTH_ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me',
  AUTH_REFRESH_TOKEN_SECRET: process.env.AUTH_REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me',
  AUTH_ACCESS_TOKEN_TTL: parseInt(process.env.AUTH_ACCESS_TOKEN_TTL || '900', 10),
  AUTH_REFRESH_TOKEN_TTL: parseInt(process.env.AUTH_REFRESH_TOKEN_TTL || '604800', 10),
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  AUTH_ISSUER: process.env.AUTH_ISSUER || 'leaderboard-api',
  AUTH_AUDIENCE: process.env.AUTH_AUDIENCE || 'leaderboard-clients',
  PASSWORD_RESET_TTL: parseInt(process.env.PASSWORD_RESET_TTL || '900', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || undefined,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: String(process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'none',
  REFRESH_COOKIE_NAME: process.env.REFRESH_COOKIE_NAME || 'refreshToken'
};

// Event queue settings (for microservice-style processing)
env.EVENT_QUEUE_ENABLED = String(process.env.EVENT_QUEUE_ENABLED || '').toLowerCase() === 'true';
env.EVENT_STREAM_KEY = process.env.EVENT_STREAM_KEY || 'events:game-results';
env.EVENT_CONSUMER_GROUP = process.env.EVENT_CONSUMER_GROUP || 'game-result-workers';
env.EVENT_CONSUMER_NAME = process.env.EVENT_CONSUMER_NAME || 'worker-1';
env.EVENT_MAXLEN = parseInt(process.env.EVENT_MAXLEN || '10000', 10);
env.EVENT_BLOCK_MS = parseInt(process.env.EVENT_BLOCK_MS || '10000', 10);
env.EVENT_BATCH_SIZE = parseInt(process.env.EVENT_BATCH_SIZE || '10', 10);
env.EVENT_ID_TTL = parseInt(process.env.EVENT_ID_TTL || '86400', 10);
env.EVENT_MAX_RETRIES = parseInt(process.env.EVENT_MAX_RETRIES || '3', 10);
env.EVENT_DLQ_STREAM = process.env.EVENT_DLQ_STREAM || 'events:dlq';
// Country sharding
env.SHARD_BY_COUNTRY = String(process.env.SHARD_BY_COUNTRY || '').toLowerCase() === 'true';
env.AGGREGATOR_ENABLED = String(process.env.AGGREGATOR_ENABLED || '').toLowerCase() === 'true';
env.AGGREGATOR_INTERVAL_MS = parseInt(process.env.AGGREGATOR_INTERVAL_MS || '60000', 10);
env.AGGREGATOR_TOP_K = parseInt(process.env.AGGREGATOR_TOP_K || '100', 10);
try { env.MODES = JSON.parse(process.env.MODES_JSON || '[]'); } catch { env.MODES = []; }
try { env.API_INGEST_KEYS = JSON.parse(process.env.API_INGEST_KEYS || '[]'); } catch { env.API_INGEST_KEYS = []; }
env.MONGO_RESULTS_URI = process.env.MONGO_RESULTS_URI || process.env.MONGO_URI || '';
env.MONGO_USERS_URI = process.env.MONGO_USERS_URI || process.env.MONGO_URI || '';
try { env.MONGO_USERS_SHARDS = JSON.parse(process.env.MONGO_USERS_SHARDS_JSON || '{}'); } catch { env.MONGO_USERS_SHARDS = {}; }
try { env.MONGO_RESULTS_SHARDS = JSON.parse(process.env.MONGO_RESULTS_SHARDS_JSON || '{}'); } catch { env.MONGO_RESULTS_SHARDS = {}; }
// Email verification and rotation
env.EMAIL_VERIFY_TTL = parseInt(process.env.EMAIL_VERIFY_TTL || '86400', 10);
env.ENFORCE_PASSWORD_ROTATION = String(process.env.ENFORCE_PASSWORD_ROTATION || 'true').toLowerCase() === 'true';
try { env.AUTH_ACCESS_KEYS = JSON.parse(process.env.AUTH_ACCESS_KEYS_JSON || '[]'); } catch { env.AUTH_ACCESS_KEYS = []; }
try { env.AUTH_REFRESH_KEYS = JSON.parse(process.env.AUTH_REFRESH_KEYS_JSON || '[]'); } catch { env.AUTH_REFRESH_KEYS = []; }
env.AUTH_ACTIVE_ACCESS_KID = process.env.AUTH_ACTIVE_ACCESS_KID || undefined;
env.AUTH_ACTIVE_REFRESH_KID = process.env.AUTH_ACTIVE_REFRESH_KID || undefined;


