# PLAN - Minimi

A time-aware chat assistant: one local user, persisted conversations, dated history,
claim re-checks, and cited web sources. UI is intentionally a Field Ledger: paper,
hairline rules, mono dates, system sans prose.

## Where things live

| Layer | File |
| --- | --- |
| UI markup | `public/index.html` |
| UI styles | `public/styles.css` |
| Client state and rendering | `public/app.js` |
| Chat/history/conversation routes | `src/server.ts` |
| Persisted turns and conversation summaries | `src/store.ts` |
| Agent loop, streaming, persistence | `src/agent.ts` |
| Date/memory context and retrieval | `src/context.ts`, `src/retrieve.ts`, `src/time.ts` |
| Prompt and claim extraction | `src/prompt.ts`, `src/claims.ts` |
| Search provider and cache | `src/search.ts` |
| Product truth and voice | `PRODUCT.md` |
| Architecture notes | `DESIGN.md` |

## This pass

- [x] Remove the top-right status chip ("On this device" / "Working").
- [x] Keep working/ready state in the `#live` screen-reader region, the disabled send button,
  and the answer skeleton instead.
- [x] ArrowUp in an empty composer recalls the previous user message in the current conversation.
- [x] Repeated ArrowUp moves further back; ArrowDown moves forward and then clears.
- [x] Do not hijack arrow keys while the user is typing a draft.
- [x] Reset recall on New entry and on conversation switch.
- [x] Show the shortcut hint in the composer footer.
- [x] No credit, billing, or usage UI.
- [x] Verify: `node --check`, `impeccable detect`, `npm run typecheck`,
  Playwright at 1440/720/390 in light and dark, refresh final screenshots.

## Chatbot next steps

### 1. Conversations

- [x] New entry, switch, persist the active conversation.
- [x] Auto-title from the first user message.
- [x] Rename a conversation.
- [x] Delete a conversation with a clear confirmation and undo-safe copy.
- [x] Search/filter the ledger rail.
- [x] Empty, loading, and error states for the rail.

### 2. Message actions

- [x] Retry a failed turn.
- [x] Stop generation (client `AbortController` + server abort on disconnect).
- [ ] Regenerate the last answer.
- [ ] Edit and resend a user message.
- [x] Copy answer.
- [ ] Copy source list.
- [x] ArrowUp/ArrowDown recall in the composer.
- [x] Preserve drafts per conversation.

### 3. Time and memory (core product)

- [x] Date resolution, timezone normalization, and history retrieval.
- [x] Claim extraction and speculative re-checks.
- [x] "as of" stamps on claims.
- [ ] Context trimming or summaries for very long conversations.
- [x] Export memory / clear one conversation / clear all data.
- [ ] Explain why a memory was or was not matched (trace exists; add plain-language copy).

### 4. Sources and trust

- [x] Inline citations, source footnotes, citation popover, published dates.
- [x] URL allowlist (`http`/`https` only) and escaped rendering.
- [ ] Deduplicate sources across answers in a conversation.
- [ ] Source quality/freshness labels and "last checked" line.
- [ ] Broken-link handling and retry when a source disappears.

### 5. Settings and data

- [x] Theme auto/light/dark.
- [x] Automatic timezone.
- [ ] Manual timezone override.
- [x] Export conversation JSON / clear local data.
- [ ] Provider/model status without exposing keys or billing/credit UI.

### 6. Accessibility and mobile

- [x] Mobile drawer with focus management, inert background, Escape, close button.
- [x] Skip link, visible focus rings, aria-live status, reduced motion.
- [x] Touch targets, safe areas, composer height, citation tap targets.
- [x] Rail entries and theme controls are keyboard reachable.
- [x] Keyboard navigation within the rail (arrow keys between entries).
- [x] Shortcut help overlay (`?`).
- [ ] Verify screen-reader announcements for streaming answers and claims.

### 7. Reliability and security

- [x] Abort in-flight streams when switching conversations or stopping.
- [ ] Rate limiting, request size caps, and per-conversation turn caps.
- [ ] Full XSS and markdown audit, including source titles.
- [ ] Server-side error logging with request ids.
- [ ] Auth seam for multi-user (`x-user-id` is the current seam).
- [ ] Prompt-injection handling for retrieved web content.

### 8. Tests and operations

- [x] TypeScript typecheck, eval harness, design detector.
- [x] Live chat smoke test and mobile/desktop layout checks.
- [ ] Committed Playwright e2e: recall, retry, history error, delete, stop, mobile drawer.
- [ ] API integration tests for `/api/chat`, `/api/history`, `/api/conversations`.
- [ ] README runbook: env, seed, dev, eval, data reset.
- [ ] Docker or one-command local start.

## UI quality bar

- Desktop: persistent ledger rail, readable prose measure, 64px timestamp gutter,
  composer anchored with the date stamp, citation popovers inside the viewport.
- Mobile: off-canvas ledger with focus trap, no horizontal overflow at 320px,
  44px coarse-pointer targets, safe-area padding, keyboard dismissed after send.
- Shared: contrast at least 4.5:1 for functional text, visible focus, no hover-only
  actions, no decorative gradients or glass effects, dates in mono, 2px radii.

## Definition of done for a UI pass

1. `public/index.html` uses the external `public/styles.css` and `public/app.js`.
2. `node --check public/app.js` and `npm run typecheck` pass.
3. Playwright checks pass at desktop, tablet, and mobile widths in light and dark, empty and populated.
4. Screenshots in `.impeccable/review/` are refreshed and dimensions are correct.
5. No console errors; no duplicate dev server started.
