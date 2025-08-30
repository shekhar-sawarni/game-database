import { Router } from 'express';
import { getLeaderboard, getRank, getRating, postGameResult } from '../controllers/leaderboardController.js';
import { signup, login, logout, refresh, updateProfile, changePassword, revokeAllSessions, requestPasswordReset, resetPassword, requestEmailVerification, confirmEmailVerification } from '../controllers/authController.js';
import { authRateLimiter, loginLimiter, requireAuth, ingestLimiter, requireIngestKey } from '../middleware/auth.js';
import { UserModel } from '../models/user.js';
import { LeaderboardManager } from '../services/leaderboardManager.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

// Optional minimal user routes could be added later

const router = Router();

router.get('/leaderboard/:mode', getLeaderboard);
router.get('/rank/:mode/:userId', getRank);
router.get('/rating/:mode/:userId', getRating);
const signupSchema = z.object({ email: z.string().email(), password: z.string().min(8), username: z.string().min(3), countryCode: z.string().length(2), region: z.string().min(2) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const gameResultSchema = z.object({ mode: z.string().min(1), countryCode: z.string().length(2).optional(), region: z.string().optional(), players: z.array(z.object({ user_id: z.union([z.string(), z.number()]), score: z.number() })).length(2) });

router.post('/event/game-result', ingestLimiter, requireIngestKey, validateBody(gameResultSchema), postGameResult);

// Auth routes
router.post('/auth/signup', authRateLimiter, validateBody(signupSchema), signup);
router.post('/auth/login', loginLimiter, validateBody(loginSchema), login);
router.post('/auth/logout', logout);
router.post('/auth/refresh', refresh);
router.post('/auth/forgot-password', authRateLimiter, requestPasswordReset);
router.post('/auth/reset-password', authRateLimiter, resetPassword);
router.post('/auth/email/request-verify', authRateLimiter, requestEmailVerification);
router.post('/auth/email/confirm-verify', authRateLimiter, confirmEmailVerification);



// Who am I
router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await UserModel.findOne({ userId: req.user.userId }).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      userId: user.userId,
      email: user.email || null,
      username: user.username || null,
      countryCode: user.countryCode || null,
      region: user.region || null
    }
  });
});

router.post('/auth/profile', requireAuth, updateProfile);
router.put('/auth/profile', requireAuth, updateProfile); // RESTful update alias
router.post('/auth/update', requireAuth, updateProfile); // Alternate alias
router.post('/auth/change-password', requireAuth, changePassword);
router.post('/auth/revoke-all', requireAuth, revokeAllSessions);
// SSE live leaderboard
router.get('/stream/leaderboard/:mode', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const { mode } = req.params;
  const send = async () => {
    const lb = new LeaderboardManager(mode);
    const top = await lb.getTopK(50);
    res.write(`data: ${JSON.stringify(top)}\n\n`);
  };
  const interval = setInterval(send, 5000);
  req.on('close', () => clearInterval(interval));
  await send();
});


export default router;


