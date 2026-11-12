import 'dotenv/config';

const tzOk = (tz?: string) => { try { if (tz) new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
};

export const config = {
  port: Number(process.env.PORT ?? 3000),
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  llmApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  modelMain: process.env.MODEL_MAIN || 'gemini-3.5-flash-lite',
  modelFast: process.env.MODEL_FAST || 'gemini-3.5-flash-lite',
  defaultTz: tzOk(process.env.DEFAULT_TZ) ? process.env.DEFAULT_TZ! : Intl.DateTimeFormat().resolvedOptions().timeZone,
  authHeader: (process.env.AUTH_HEADER || 'x-user-id').toLowerCase(),
  maxSteps: 4,
  liveTurns: 10,
  summaryTurns: 24,
  maxPrefetch: 6,
  searchTtlMs: 15 * 60 * 1000,
  dataFile: process.env.DATA_FILE || 'data/store.json',
  maxBodyBytes: int(process.env.MAX_BODY_BYTES, 32 * 1024, 1024, 1024 * 1024),
  maxMessageChars: int(process.env.MAX_MESSAGE_CHARS, 4000, 100, 32_000),
  maxTurnsPerConv: int(process.env.MAX_TURNS_PER_CONV, 200, 10, 5000),
  chatRateLimit: int(process.env.CHAT_RATE_LIMIT, 12, 1, 1000),
  chatRateWindowMs: int(process.env.CHAT_RATE_WINDOW_MS, 60_000, 1_000, 3_600_000),
  apiRateLimit: int(process.env.API_RATE_LIMIT, 120, 10, 10_000),
  apiRateWindowMs: int(process.env.API_RATE_WINDOW_MS, 60_000, 1_000, 3_600_000),
};
export const validTz = tzOk;
/** The one place the clock is read, so tests and demos can fake it. */
export const clock = () => (process.env.NOW_OVERRIDE ? new Date(process.env.NOW_OVERRIDE) : new Date());
