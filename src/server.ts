import { serve } from '@hono/node-server';
import OpenAI from 'openai';
import { createApp } from './app.js';
import { config } from './config.js';
import { makeSearch } from './search.js';
import { Store } from './store.js';

for (const k of ['GEMINI_API_KEY', 'TAVILY_API_KEY'])
  if (!process.env[k]) console.warn(`? ${k} is not set (copy .env.example to .env)`);

const store = await new Store(config.dataFile).init();
const llm = new OpenAI({ apiKey: config.llmApiKey || 'not-set', baseURL: config.llmBaseUrl });
const app = createApp({ store, search: makeSearch(), llm });
const server = serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`Agent on http://localhost:${i.port}`));

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use by another process.\n` +
      `Stop it, or set PORT to a free port in .env (e.g. PORT=3001) and run again.`,
    );
    process.exit(1);
  }
  throw err;
});
