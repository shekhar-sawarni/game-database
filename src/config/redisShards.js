import Redis from 'ioredis';
import { env } from './env.js';

const shardClients = new Map();

function parseShards(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr || '{}');
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}

const shardsConfig = parseShards(process.env.REDIS_SHARDS_JSON);

export function getRedisForCountry(countryCode) {
  if (!countryCode) return null;
  const cc = String(countryCode).toUpperCase();
  if (shardClients.has(cc)) return shardClients.get(cc);
  const url = shardsConfig[cc];
  if (!url) return null;
  const client = new Redis(url);
  shardClients.set(cc, client);
  return client;
}

export function listShardCountries() {
  return Object.keys(shardsConfig);
}


