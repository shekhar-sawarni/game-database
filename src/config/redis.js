import Redis from 'ioredis';
import { env } from './env.js';
import IORedisMock from 'ioredis-mock';

let redisClient;

if (env.REDIS_MOCK) {
  redisClient = new IORedisMock();
} else if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL);
} else {
  const base = { host: env.REDIS_HOST, port: env.REDIS_PORT };
  const auth = {};
  if (env.REDIS_USERNAME) auth.username = env.REDIS_USERNAME;
  if (env.REDIS_PASSWORD) auth.password = env.REDIS_PASSWORD;
  const tls = env.REDIS_TLS ? { tls: {} } : {};
  redisClient = new Redis({ ...base, ...auth, ...tls });
}

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connecting...');
});

redisClient.on('ready', () => {
  console.log('Redis connected and ready');
});

redisClient.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redisClient.on('end', () => {
  console.log('Redis connection closed');
});

export { redisClient };


