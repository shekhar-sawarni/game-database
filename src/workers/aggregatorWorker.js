import { env } from '../config/env.js';
import { aggregateCountryTopK } from '../services/aggregator.js';

async function run() {
  if (!env.AGGREGATOR_ENABLED) {
    console.log('Aggregator disabled');
    process.exit(0);
  }
  if (!env.MODES?.length) {
    console.log('No modes configured to aggregate');
    process.exit(0);
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      for (const mode of env.MODES) {
        await aggregateCountryTopK(mode);
      }
    } catch (err) {
      console.error('Aggregator error:', err.message);
    }
    await new Promise(r => setTimeout(r, env.AGGREGATOR_INTERVAL_MS));
  }
}

run().catch((e) => {
  console.error('Aggregator fatal error:', e);
  process.exit(1);
});


