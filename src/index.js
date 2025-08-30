import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { connectMongo } from './config/mongo.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { getMetrics, httpLatencyMiddleware } from './services/metrics.js';
import { aggregateCountryTopK } from './services/aggregator.js';
import { httpLogger } from './services/logger.js';

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(httpLogger);
app.use(httpLatencyMiddleware);


// Minimal OpenAPI spec
const openapi = {
  openapi: '3.0.0',
  info: { title: 'Leaderboard API', version: '1.0.0' },
  servers: [{ url: `http://localhost:${env.PORT}` }]
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.use('/', routes);

app.get('/health', async (_req, res) => {
  const health = { ok: true };
  // Redis
  try {
    // @ts-ignore
    const pong = await (await import('./config/redis.js')).then(m => m.redisClient.ping());
    health.redis = pong === 'PONG';
  } catch { health.redis = false; }
  // Mongo
  try {
    const { default: mongoose } = await import('mongoose');
    health.mongo = mongoose.connection?.readyState === 1;
  } catch { health.mongo = false; }
  res.json(health);
});

app.get('/metrics', async (_req, res) => {
  try {
    const output = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(output);
  } catch (e) {
    res.status(500).send(String(e?.message || 'metrics error'));
  }
});

app.post('/aggregate/:mode', async (req, res) => {
  try {
    await aggregateCountryTopK(req.params.mode);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || 'aggregate error') });
  }
});

app.get('/queue/stats', async (_req, res) => {
  try {
    const { env } = await import('./config/env.js');
    const { redisClient } = await import('./config/redis.js');
    const info = await redisClient.xinfo('STREAM', env.EVENT_STREAM_KEY);
    res.json({ stream: env.EVENT_STREAM_KEY, info });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || 'queue error') });
  }
});

app.get('/shards/health', async (_req, res) => {
  const { listShardCountries, getRedisForCountry } = await import('./config/redisShards.js');
  const countries = listShardCountries();
  const result = {};
  for (const cc of countries) {
    const client = getRedisForCountry(cc);
    if (!client) { result[cc] = false; continue; }
    try {
      result[cc] = (await client.ping()) === 'PONG';
    } catch { result[cc] = false; }
  }
  res.json({ redis: result });
});

// 404 and error handler
app.use((req, res, next) => {
  if (req.path === '/docs' || req.path.startsWith('/docs/')) return next();
  res.status(404).json({ error: 'Not Found' });
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(env.PORT, async () => {
  await connectMongo();
  console.log(`API listening on :${env.PORT}`);
});


