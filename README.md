# Real-Time Leaderboard Backend (Node.js + Redis + MongoDB)

Express API with Redis ZSET leaderboards (sharded), exact rank via ZCOUNT across shards, top-K cache, and optional MongoDB for metadata.

## Quick start (no Docker)

1. Install deps:
   - Node 18+
   - Redis running locally on 6379
   - (Optional) MongoDB on 27017

2. Copy env:
```
cp .env.example .env
```

3. Install and run (backend):
```
npm install
npm run dev
```

4. Frontend (React PWA):
```
cd frontend-react
npm install
npm run dev
```
The app proxies API calls to `http://localhost:8000`. A PWA manifest and service worker are registered; you can install the app and it will cache `questions.json` for offline play.

4. Seed sample data:
```
node scripts/seed.js blitz
```

5. Try endpoints:
```
GET http://localhost:8000/health
GET http://localhost:8000/leaderboard/blitz
GET http://localhost:8000/rank/blitz/1001
GET http://localhost:8000/rating/blitz/1001
POST http://localhost:8000/event/game-result
{
  "mode": "blitz",
  "players": [
    {"user_id": "1001", "score": 1},
    {"user_id": "1002", "score": 0}
  ],
  "countryCode": "US"
}
```

## Notes
- Leaderboards: `lb:{mode}:global:{shard}` ZSETs, `lb:{mode}:topK` cache, `lb:{mode}:day:YYYYMMDD` with TTL.
- Exact rank: sum `ZCOUNT (score, +inf)` across shards + 1.
- Configure shards and Top-K via `.env`.

## Auth API

- POST `/auth/signup` { email, password, username, countryCode, region }
- POST `/auth/login` { email, password }
- POST `/auth/logout` (uses cookie/header/body refresh token)
- POST `/auth/refresh` (rotates tokens; reads refresh from cookie/header/body)
- GET `/auth/me` (Bearer access token)
- POST `/auth/profile` { username?, countryCode?, region? } (Bearer)
- POST `/auth/change-password` { oldPassword, newPassword } (Bearer)
- POST `/auth/forgot-password` { email }
- POST `/auth/reset-password` { token, newPassword }

### Tokens
- Access: Bearer in `Authorization` header.
- Refresh: HttpOnly cookie (`REFRESH_COOKIE_NAME`), also accepted via header `x-refresh-token` or body.

## Leaderboards
- `GET /leaderboard/:mode?region=EU&countryCode=IN`
- `GET /rank/:mode/:userId?region=EU&countryCode=IN`

## Environment (.env)

```
PORT=8000
MONGO_URI=mongodb://localhost:27017/leaderboard
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
AUTH_ACCESS_TOKEN_SECRET=replace-me
AUTH_REFRESH_TOKEN_SECRET=replace-me
AUTH_ACCESS_TOKEN_TTL=900
AUTH_REFRESH_TOKEN_TTL=604800
BCRYPT_SALT_ROUNDS=10
AUTH_ISSUER=leaderboard-api
AUTH_AUDIENCE=leaderboard-clients
PASSWORD_RESET_TTL=900
CORS_ORIGIN=http://localhost:3000
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
REFRESH_COOKIE_NAME=refreshToken
```


