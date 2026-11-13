export interface Claim {
  entity: string;
  claim: string;
  as_of: string; // YYYY-MM-DD: the date the claim was true as far as we knew
  check_query: string; // short web query that would reveal whether it changed
}
export interface Source { id: number; title: string; url: string; published?: string }
export type VerdictKind = 'changed' | 'unchanged' | 'unverified';
export interface Verdict { entity: string; verdict: VerdictKind; note?: string; source?: number }
export interface ConvMeta { title?: string; pinned?: boolean; archived?: boolean }
export interface Turn {
  id: string; uid: string; conv: string;
  ts: string; // ISO UTC, when the user sent the message
  tz: string; user: string; assistant: string;
  claims: Claim[]; sources: Source[]; verdicts?: Verdict[];
}
export interface Hit { title: string; url: string; content: string; raw?: string; published?: string; dated: boolean }
export type SearchOpts = { since?: string; topic?: 'general' | 'news'; entity?: string; includeDomains?: string[] };
export type SearchFn = (query: string, opts?: SearchOpts) => Promise<Hit[]>;

export type AgentEvent =
  | { type: 'context'; data: unknown }
  | { type: 'status'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'claims'; turnId: string; claims: Claim[] }
  | { type: 'verdicts'; turnId: string; checks: Verdict[] }
  | { type: 'done'; turnId: string; ttftMs: number | null; totalMs: number; searches: number; answer: string }
  | { type: 'error'; message: string };
