import 'dotenv/config';

const tzOk = (tz?: string) => { try { if (tz) new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };

export const config = {
  port: Number(process.env.PORT ?? 3000),
  modelMain: process.env.MODEL_MAIN || 'claude-sonnet-5-5',
  modelFast: process.env.MODEL_FAST || 'claude-haiku-5-5',
  defaultTz: tzOk(process.env.DEFAULT_TZ) ? process.env.DEFAULT_TZ! : Intl.DateTimeFormat().resolvedOptions().timeZone,
  maxSteps: 4,
  searchTtlMs: 15 * 60 * 1000,
  dataFile: process.env.DATA_FILE || 'data/store.json',
};
export const validTz = tzOk;
/** The one place the clock is read, so tests and demos can fake it. */
export const clock = () => (process.env.NOW_OVERRIDE ? new Date(process.env.NOW_OVERRIDE) : new Date());
