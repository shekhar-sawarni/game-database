import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/user.js';
import { env } from '../config/env.js';
import { issueTokenPair, verifyRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from '../services/tokenService.js';
import validator from 'validator';
import { redisClient } from '../config/redis.js';
import { counters } from '../services/metrics.js';
import { logger } from '../services/logger.js';

function pickUserSafe(userDoc) {
  return {
    userId: userDoc.userId,
    email: userDoc.email || null,
    username: userDoc.username || null,
    countryCode: userDoc.countryCode || null
  };
}

export async function signup(req, res) {
  try {
    const { email, password, username, countryCode, region } = req.body || {};
    if (!email || !password || !username || !countryCode || !region) {
      return res.status(400).json({ error: 'Email, password, username, countryCode and region are required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) return res.status(400).json({ error: 'Invalid email' });
    if (!validator.isLength(password, { min: 8 })) return res.status(400).json({ error: 'Password too short (min 8)' });
    if (!validator.isAlphanumeric(username, 'en-US', { ignore: '._-' }) || username.length < 3) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    const cc = String(countryCode).trim().toUpperCase();
    const rgn = String(region).trim().toUpperCase();
    if (!validator.isISO31661Alpha2(cc)) return res.status(400).json({ error: 'Invalid countryCode' });
    const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(String(password), salt);
    const userId = uuidv4();
    const user = await UserModel.create({ userId, email: normalizedEmail, passwordHash, username, countryCode: cc, region: rgn });
    const tokens = await issueTokenPair(user);
    counters.auth_events_total.inc({ type: 'signup_success' });
    // Set refresh token cookie (HttpOnly)
    if (tokens.refreshToken) {
      res.cookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: env.AUTH_REFRESH_TOKEN_TTL * 1000
      });
    }
    return res.status(201).json({ user: pickUserSafe(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    logger.error({ err }, 'signup failed');
    counters.auth_events_total.inc({ type: 'signup_error' });
    if (err && (err.code === 11000 || String(err?.message || '').includes('E11000'))) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    return res.status(500).json({ error: 'Signup failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) return res.status(400).json({ error: 'Invalid email' });
    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user?.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const tokens = await issueTokenPair(user);
    counters.auth_events_total.inc({ type: 'login_success' });
    if (tokens.refreshToken) {
      res.cookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: env.AUTH_REFRESH_TOKEN_TTL * 1000
      });
    }
    return res.json({ user: pickUserSafe(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    logger.error({ err }, 'login failed');
    counters.auth_events_total.inc({ type: 'login_error' });
    return res.status(500).json({ error: err.message });
  }
}

export async function refresh(req, res) {
  try {
    const headerToken = req.headers['x-refresh-token'];
    const bodyToken = req.body?.refreshToken;
    const cookieToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
    const token = typeof headerToken === 'string' && headerToken ? headerToken : (cookieToken || bodyToken);
    if (!token) return res.status(400).json({ error: 'refreshToken is required' });
    const result = await verifyRefreshToken(token);
    if (!result.valid) return res.status(401).json({ error: 'Invalid refresh token' });
    const { decoded } = result;
    const user = await UserModel.findOne({ userId: String(decoded.sub) });
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });
    // rotate: revoke old and issue new pair
    await revokeRefreshToken(String(decoded.jti), String(decoded.sub));
    const tokens = await issueTokenPair(user);
    if (tokens.refreshToken) {
      res.cookie(env.REFRESH_COOKIE_NAME, tokens.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: env.AUTH_REFRESH_TOKEN_TTL * 1000
      });
    }
    return res.json({ user: pickUserSafe(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function logout(req, res) {
  try {
    const headerToken = req.headers['x-refresh-token'];
    const bodyToken = req.body?.refreshToken;
    const cookieToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
    const token = typeof headerToken === 'string' && headerToken ? headerToken : (cookieToken || bodyToken);
    if (!token) return res.status(400).json({ error: 'refreshToken is required' });
    const result = await verifyRefreshToken(token);
    if (!result.valid) return res.status(200).json({ ok: true });
    const { decoded } = result;
    await revokeRefreshToken(String(decoded.jti), String(decoded.sub));
    res.clearCookie(env.REFRESH_COOKIE_NAME, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, domain: env.COOKIE_DOMAIN });
    counters.auth_events_total.inc({ type: 'logout' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const { username, countryCode, region } = req.body || {};
    const updates = {};
    if (typeof username === 'string') updates.username = username;
    if (typeof countryCode === 'string') updates.countryCode = countryCode.toUpperCase();
    if (typeof region === 'string') updates.region = region.toUpperCase();
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates provided' });
    const user = await UserModel.findOneAndUpdate({ userId: req.user.userId }, { $set: updates }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: pickUserSafe(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword are required' });
    const user = await UserModel.findOne({ userId: req.user.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(String(oldPassword), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    if (!validator.isLength(newPassword, { min: 8 })) return res.status(400).json({ error: 'Password too short (min 8)' });
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(String(newPassword), salt);
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function revokeAllSessions(req, res) {
  try {
    await revokeAllUserRefreshTokens(req.user.userId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!validator.isEmail(normalizedEmail)) return res.status(400).json({ error: 'Invalid email' });
    const user = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (user) {
      const token = uuidv4();
      await redisClient.set(`pwreset:${token}`, String(user.userId), 'EX', env.PASSWORD_RESET_TTL);
    }
    // Always respond OK to avoid user enumeration
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword are required' });
    if (!validator.isLength(newPassword, { min: 8 })) return res.status(400).json({ error: 'Password too short (min 8)' });
    const userId = await redisClient.get(`pwreset:${token}`);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });
    const user = await UserModel.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(String(newPassword), salt);
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    await user.save();
    await redisClient.del(`pwreset:${token}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Email verification
export async function requestEmailVerification(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (!user) return res.status(200).json({ ok: true });
    const token = uuidv4();
    await redisClient.set(`emailverify:${token}`, String(user.userId), 'EX', env.EMAIL_VERIFY_TTL);
    // Normally send email with link containing token
    return res.json({ ok: true, token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function confirmEmailVerification(req, res) {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const userId = await redisClient.get(`emailverify:${token}`);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });
    await UserModel.updateOne({ userId }, { $set: { emailVerified: true } });
    await redisClient.del(`emailverify:${token}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

