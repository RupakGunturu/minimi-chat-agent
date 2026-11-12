import { clock, config } from '../src/config.js';
import { seedTurns } from '../src/seed-data.js';
import { Store } from '../src/store.js';

const store = await new Store(config.dataFile).init();
const turns = seedTurns(clock(), config.defaultTz);
await store.reset(turns);
console.log(`Seeded ${turns.length} turns into ${config.dataFile}:`);
for (const t of turns) console.log(`  ${t.ts.slice(0, 10)}  ${t.user.slice(0, 70)}`);
