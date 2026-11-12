import { resolveDates, isoDate } from './time.js';
import type { Turn } from './types.js';

/**
 * Demo history so reviewers can try the temporal prompts immediately.
 * Contents are illustrative and may be stale on purpose: the agent should find where reality differs.
 */
export function seedTurns(now: Date, tz: string, uid = 'local'): Turn[] {
  const at = (iso: string) => new Date(`${iso}T08:00:00Z`).toISOString();
  const lt = resolveDates('last Tuesday', now, tz, true)[0];
  const lastTue = lt.alt ?? lt.date; // the Tuesday a week back when 'last Tuesday' is ambiguous
  const monday = resolveDates('Monday', now, tz, true)[0].date;
  const today = isoDate(now, tz);
  let nov3 = `${today.slice(0, 4)}-11-03`;
  if (nov3 > today) nov3 = `${+today.slice(0, 4) - 1}-11-03`;

  return [
    {
      id: 'seed-postgres', uid, conv: 'seed-postgres', ts: at(lastTue), tz,
      user: 'Which managed Postgres should I use for a small production app? Rough pricing please.',
      assistant:
        'For a small production app I would shortlist three: Neon (Launch plan, about $19/month, scale-to-zero and branching), Supabase (Pro, $25/month per project, bundles auth and storage) and AWS RDS (db.t4g.micro from roughly $13/month plus storage, no free tier after the first year). Neon and Supabase are cheapest to start; RDS gives the most control.',
      claims: [
        { entity: 'Neon Launch plan', claim: 'About $19/month', as_of: lastTue, check_query: 'Neon Postgres pricing plans' },
        { entity: 'Supabase Pro plan', claim: '$25/month per project', as_of: lastTue, check_query: 'Supabase pricing Pro plan' },
        { entity: 'AWS RDS PostgreSQL', claim: 'db.t4g.micro from about $13/month plus storage', as_of: lastTue, check_query: 'AWS RDS PostgreSQL db.t4g.micro pricing' },
      ],
      sources: [],
    },
    {
      id: 'seed-vector', uid, conv: 'seed-vector', ts: at(nov3), tz,
      user: 'Best open-source vector database for a team of three?',
      assistant:
        'If you already run Postgres, use pgvector (latest release I know of is 0.8.0). Otherwise Qdrant is the easiest to operate: Apache-2.0 licensed, single binary. Milvus is heavier and only worth it at large scale.',
      claims: [
        { entity: 'pgvector', claim: 'Latest release 0.8.0', as_of: nov3, check_query: 'pgvector latest release' },
        { entity: 'Qdrant', claim: 'Apache-2.0 licensed, single-binary deployment', as_of: nov3, check_query: 'Qdrant license open source' },
      ],
      sources: [],
    },
    {
      id: 'seed-crm', uid, conv: 'seed-crm', ts: at(monday), tz,
      user: 'Shortlist 5 CRM tools for a 20-person B2B sales team, under $50 per user per month.',
      assistant:
        'Shortlist: HubSpot Sales Hub Starter (about $20/seat/month), Pipedrive Advanced (about $29.90/seat/month), Zoho CRM Professional (about $23/seat/month), Close Startup (about $49/seat/month) and Salesforce Starter Suite (about $25/seat/month). Pipedrive and HubSpot are the easiest to roll out; Salesforce scales furthest.',
      claims: [
        { entity: 'HubSpot Sales Hub Starter', claim: 'About $20/seat/month', as_of: monday, check_query: 'HubSpot Sales Hub Starter pricing' },
        { entity: 'Pipedrive Advanced', claim: 'About $29.90/seat/month', as_of: monday, check_query: 'Pipedrive pricing Advanced plan' },
        { entity: 'Zoho CRM Professional', claim: 'About $23/seat/month', as_of: monday, check_query: 'Zoho CRM Professional pricing' },
        { entity: 'Close Startup', claim: 'About $49/seat/month', as_of: monday, check_query: 'Close CRM pricing Startup plan' },
        { entity: 'Salesforce Starter Suite', claim: 'About $25/seat/month', as_of: monday, check_query: 'Salesforce Starter Suite pricing' },
      ],
      sources: [],
    },
  ];
}
