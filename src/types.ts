export interface Claim {
  entity: string;
  claim: string;
  as_of: string; // YYYY-MM-DD: the date the claim was true as far as we knew
  check_query: string; // short web query that would reveal whether it changed
}
export interface Source { id: number; title: string; url: string; published?: string }
export interface Turn {
  id: string; uid: string; conv: string;
  ts: string; // ISO UTC, when the user sent the message
  tz: string; user: string; assistant: string;
  claims: Claim[]; sources: Source[];
}
export interface Hit { title: string; url: string; content: string; published?: string; dated: boolean }
export type SearchOpts = { since?: string; topic?: 'general' | 'news' };
export type SearchFn = (query: string, opts?: SearchOpts) => Promise<Hit[]>;

export type AgentEvent =
  | { type: 'context'; data: unknown }
  | { type: 'status'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; turnId: string; ttftMs: number | null; totalMs: number; searches: number }
  | { type: 'error'; message: string };
