import client from 'prom-client';

client.collectDefaultMetrics();

export const counters = {
  http_requests_total: new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
  }),
  auth_events_total: new client.Counter({
    name: 'auth_events_total',
    help: 'Auth events counter',
    labelNames: ['type']
  }),
  game_events_total: new client.Counter({
    name: 'game_events_total',
    help: 'Game events counter',
    labelNames: ['type']
  })
};

export const httpHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration (s)',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

export function httpLatencyMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const diff = process.hrtime.bigint() - start;
      const seconds = Number(diff) / 1e9;
      const route = (req.route && req.route.path) || (req.baseUrl ? req.baseUrl : '') + (req.path || '') || 'unknown';
      httpHistogram.labels(String(req.method), String(route), String(res.statusCode)).observe(seconds);
    } catch {}
  });
  next();
}

export async function getMetrics() {
  return client.register.metrics();
}


