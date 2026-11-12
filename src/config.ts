import 'dotenv/config';

const tzOk = (tz?: string) => { try { if (tz) new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };

export const config = {
  port: Number(process.env.PORT ?? 3000),
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  llmApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  modelMain: process.env.MODEL_MAIN || 'gemini-3.5-flash-lite',
  modelFast: process.env.MODEL_FAST || 'gemini-3.5-flash-lite',
  defaultTz: tzOk(process.env.DEFAULT_TZ) ? process.env.DEFAULT_TZ! : Intl.DateTimeFormat().resolvedOptions().timeZone,
  maxSteps: 4,
  searchTtlMs: 15 * 60 * 1000,
  dataFile: process.env.DATA_FILE || 'data/store.json',
};
export const validTz = tzOk;
/** The one place the clock is read, so tests and demos can fake it. */
export const clock = () => (process.env.NOW_OVERRIDE ? new Date(process.env.NOW_OVERRIDE) : new Date());
