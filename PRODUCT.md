# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person using a personal daily assistant in the browser, often months into an ongoing relationship with it. They ask questions whose meaning depends on the calendar ("last Tuesday", "3 November") and on things they discussed earlier ("that shortlist", "has the price changed since?"). They expect the assistant to remember and to be honest when it does not.

## Product Purpose

Minimi is a time-aware chat assistant. It resolves dates correctly, retrieves relevant earlier conversations, and re-checks old claims against current sources before answering. Success is a user trusting that "what did I ask on 3 November?" and "is your answer still correct today?" are answered from real history and real sources, not improvised.

## Positioning

Time and memory live in ordinary code, not in the model's head: chrono-based date resolution against the user's timezone, a timestamped turn store, structured claims extracted per answer, and speculative re-verification that runs the right searches before the first model token. The model never does calendar arithmetic and never invents history.

## Operating Context

A single-page web chat, one local user, conversations persisted in a JSON store. History is date-addressed and can be seeded with illustrative demo turns; `NOW_OVERRIDE` fakes the clock for demos. Answers cite numbered web sources. The app is expected to be run locally with `npm run dev`.

## Capabilities and Constraints

- One tool only: `web_search` (Tavily), with `since` fanning out into dated and current searches.
- One streaming model loop with a hard four-step cap and parallel tool calls.
- Turns stored with UTC timestamps and timezone; retrieval is BM25-style date + topic + claim scoring over small histories.
- Claims are extracted asynchronously after the answer and reused for re-verification.
- Conversation history is per-conversation, persisted locally; the `x-user-id` header is the seam for multi-user.
- Static frontend (HTML/CSS/JS) served by a Hono server; chat streams as NDJSON events.
- Honest negatives are structural: changed / unchanged / couldn't verify, never "nothing changed" without naming what was checked.

## Brand Commitments

- Name: **Minimi**.
- Voice: direct, precise, calm. No filler, no emojis, no apologies. Names what it checked.
- The product's differentiator is time and memory; the interface must make those visible rather than hide them.

## Evidence on Hand

- `DESIGN.md` documents the architecture and its tradeoffs.
- `src/seed-data.ts` contains illustrative demo history that may be deliberately stale; it is synthetic, not real customer data.
- No real user testimonials, benchmarks, customers, or press exist. Future work must not fabricate them.

## Product Principles

1. Time is shown, not guessed: resolved dates and "now" are visible where they affect an answer.
2. Memory is legible: earlier turns and the claims behind them can be inspected, not just asserted.
3. Honesty beats confidence: the UI distinguishes verified change, verified stability, and failure to verify.
4. The tool disappears into the task: familiar chat behavior, fast, keyboard-first.
5. One idea per surface: the mechanism (time + memory) earns the design, not decoration.

## Accessibility & Inclusion

Keyboard-first operation with visible focus, reduced-motion support, contrast that meets WCAG AA, and a layout that works from small phones to desktop. No product-specific standard beyond that has been established.
