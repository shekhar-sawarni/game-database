import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';

function buildAccessPayload(user) {
  return {
    sub: user.userId,
    email: user.email || undefined,
    type: 'access'
  };
}

function selectSigningKey(keysArray, fallbackSecret, activeKid) {
  if (Array.isArray(keysArray) && keysArray.length > 0) {
    const byActive = keysArray.find(k => String(k?.kid || '') === String(activeKid || '')) || keysArray[0];
    return { secret: byActive.secret, kid: byActive.kid };
  }
  return { secret: fallbackSecret, kid: undefined };
}

export function issueAccessToken(user) {
  const payload = buildAccessPayload(user);
  const { secret, kid } = selectSigningKey(env.AUTH_ACCESS_KEYS, env.AUTH_ACCESS_TOKEN_SECRET, env.AUTH_ACTIVE_ACCESS_KID);
  const options = {
    expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE
  };
  if (kid) options.header = { kid };
  return jwt.sign(payload, secret, options);
}

export async function issueRefreshToken(user) {
  const jti = uuidv4();
  const payload = { sub: user.userId, jti, type: 'refresh' };
  const { secret, kid } = selectSigningKey(env.AUTH_REFRESH_KEYS, env.AUTH_REFRESH_TOKEN_SECRET, env.AUTH_ACTIVE_REFRESH_KID);
  const options = {
    expiresIn: env.AUTH_REFRESH_TOKEN_TTL,
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE
  };
  if (kid) options.header = { kid };
  const token = jwt.sign(payload, secret, options);
  const key = `refresh:${jti}`;
  await redisClient.set(key, String(user.userId), 'EX', env.AUTH_REFRESH_TOKEN_TTL);
  await redisClient.sadd(`refresh_user:${user.userId}`, jti);
  // best effort expiry on the set
  await redisClient.expire(`refresh_user:${user.userId}`, env.AUTH_REFRESH_TOKEN_TTL);
  return { token, jti };
}

export function verifyAccessToken(token) {
  try {
    const complete = jwt.decode(token, { complete: true });
    const kid = complete?.header?.kid;
    const trySecrets = [];
    if (kid && Array.isArray(env.AUTH_ACCESS_KEYS)) {
      const match = env.AUTH_ACCESS_KEYS.find(k => String(k?.kid || '') === String(kid));
      if (match?.secret) trySecrets.push(match.secret);
    }
    if (env.AUTH_ACCESS_TOKEN_SECRET) trySecrets.push(env.AUTH_ACCESS_TOKEN_SECRET);
    if (Array.isArray(env.AUTH_ACCESS_KEYS)) {
      for (const k of env.AUTH_ACCESS_KEYS) if (k?.secret) trySecrets.push(k.secret);
    }
    for (const secret of trySecrets) {
      try {
        const decoded = jwt.verify(token, secret, { issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE });
        if (decoded?.type !== 'access') continue;
        return decoded;
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token) {
  try {
    const complete = jwt.decode(token, { complete: true });
    const kid = complete?.header?.kid;
    const trySecrets = [];
    if (kid && Array.isArray(env.AUTH_REFRESH_KEYS)) {
      const match = env.AUTH_REFRESH_KEYS.find(k => String(k?.kid || '') === String(kid));
      if (match?.secret) trySecrets.push(match.secret);
    }
    if (env.AUTH_REFRESH_TOKEN_SECRET) trySecrets.push(env.AUTH_REFRESH_TOKEN_SECRET);
    if (Array.isArray(env.AUTH_REFRESH_KEYS)) {
      for (const k of env.AUTH_REFRESH_KEYS) if (k?.secret) trySecrets.push(k.secret);
    }
    for (const secret of trySecrets) {
      try {
        const decoded = jwt.verify(token, secret, { issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE });
        if (decoded?.type !== 'refresh' || !decoded?.jti) continue;
        const jti = String(decoded.jti);
        const key = `refresh:${jti}`;
        const userIdFromStore = await redisClient.get(key);
        if (!userIdFromStore) continue;
        if (String(decoded.sub) !== String(userIdFromStore)) continue;
        return { valid: true, decoded };
      } catch {}
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export async function revokeRefreshToken(jti, userId) {
  const key = `refresh:${jti}`;
  await redisClient.del(key);
  if (userId) {
    await redisClient.srem(`refresh_user:${userId}`, jti);
  }
}

export async function revokeAllUserRefreshTokens(userId) {
  const setKey = `refresh_user:${userId}`;
  const allJtis = await redisClient.smembers(setKey);
  if (allJtis?.length) {
    const keys = allJtis.map(j => `refresh:${j}`);
    await redisClient.del(...keys);
  }
  await redisClient.del(setKey);
}

export async function issueTokenPair(user) {
  const accessToken = issueAccessToken(user);
  const { token: refreshToken } = await issueRefreshToken(user);
  return { accessToken, refreshToken };
}


