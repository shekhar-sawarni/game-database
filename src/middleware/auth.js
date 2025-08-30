import { verifyAccessToken } from '../services/tokenService.js';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.js';

export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = { userId: String(decoded.sub), email: decoded.email || null };
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = typeof req.query?.access_token === 'string' && req.query.access_token ? String(req.query.access_token) : null;
  const token = headerToken || queryToken;
  const decoded = token ? verifyAccessToken(token) : null;
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { userId: String(decoded.sub), email: decoded.email || null, iat: decoded.iat };
  if (!env.ENFORCE_PASSWORD_ROTATION) return next();
  // Enforce password rotation: token iat must be >= passwordChangedAt
  UserModel.findOne({ userId: req.user.userId }, { passwordChangedAt: 1 }).lean().then((user) => {
    if (!user || !user.passwordChangedAt) return next();
    const tokenIatSec = Number(req.user.iat || 0);
    const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
    if (tokenIatSec < changedAtSec) return res.status(401).json({ error: 'Token expired by password change' });
    next();
  }).catch(() => res.status(500).json({ error: 'Auth check failed' }));
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

export const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

export function requireIngestKey(req, res, next) {
  const key = req.headers['x-api-key'];
  try {
    if (Array.isArray(env.API_INGEST_KEYS) && env.API_INGEST_KEYS.length > 0) {
      if (!key || !env.API_INGEST_KEYS.includes(String(key))) return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {}
  next();
}


