import { redisClient } from '../config/redis.js';
import { env } from '../config/env.js';
import { processGameResultEvent } from '../services/eventProcessor.js';

async function ensureGroup() {
  try {
    await redisClient.xgroup('CREATE', env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, '$', 'MKSTREAM');
  } catch (err) {
    if (!String(err?.message || '').includes('BUSYGROUP')) throw err;
  }
}

async function run() {
  await ensureGroup();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await redisClient.xreadgroup('GROUP', env.EVENT_CONSUMER_GROUP, env.EVENT_CONSUMER_NAME, 'BLOCK', env.EVENT_BLOCK_MS, 'COUNT', env.EVENT_BATCH_SIZE, 'STREAMS', env.EVENT_STREAM_KEY, '>');
    if (!resp) continue;
    for (const [, entries] of resp) {
      for (const [id, fields] of entries) {
        const map = {};
        for (let i = 0; i < fields.length; i += 2) map[fields[i]] = fields[i + 1];
        try {
          if (map.type === 'game_result') {
            const payload = JSON.parse(map.payload || '{}');
            try {
              await processGameResultEvent(payload);
              await redisClient.xack(env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, id);
            } catch (err) {
              const tries = Number(map.tries || 0) + 1;
              if (tries >= env.EVENT_MAX_RETRIES) {
                await redisClient.xadd(env.EVENT_DLQ_STREAM, '*', 'type', map.type, 'payload', map.payload, 'error', String(err?.message || 'error'));
                await redisClient.xack(env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, id);
              } else {
                // re-enqueue with incremented tries
                await redisClient.xadd(env.EVENT_STREAM_KEY, '*', 'type', map.type, 'payload', map.payload, 'tries', String(tries));
                await redisClient.xack(env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, id);
              }
            }
          } else {
            await redisClient.xack(env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, id);
          }
        } catch (err) {
          console.error('Worker error processing entry', id, err.message);
          // Optionally XADD to a DLQ stream
          await redisClient.xack(env.EVENT_STREAM_KEY, env.EVENT_CONSUMER_GROUP, id);
        }
      }
    }
  }
}

run().catch((e) => {
  console.error('Worker fatal error:', e);
  process.exit(1);
});


