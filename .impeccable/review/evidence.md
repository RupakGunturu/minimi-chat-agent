# Finish review evidence — Minimi chat

## Original request
Redesign the existing Minimi time-aware chat agent professionally. Keep the working Gemini + Tavily backend. Add a purposeful loading animation, chat-history sidebar, better citations, mobile polish, a theme toggle, and a new empty state. The user chose the **Field Ledger** direction.

## Confirmed decisions
- Direction: Field Ledger (archival ledger world).
- Mode: Operate.
- Build path: code-led. No approved comp; no comp round. The decision page could not run in this CLI session, so the structured-question fallback was used and the user picked Field Ledger.
- No external fonts or images; the surface is one self-contained `public/index.html` with inline CSS/JS.
- Theme: Auto / Light / Dark, persisted in `minimi-theme`.
- Conversation: persisted in `minimi-conv`; history from `/api/history`; rail from `/api/conversations`.

## Artifact
- `C:\Users\guntu\OneDrive\Desktop\minimi-chat\minimi-agent\public\index.html`
- Backend touched for the UI: `src/store.ts`, `src/types.ts`, `src/agent.ts`, `src/server.ts`.
- Product truth: `PRODUCT.md`.
- Existing design doc: `DESIGN.md` (pre-redesign; needs replacement at finish).
- Direction contract: `.impeccable/surfaces/chat.md`.

## Direction contract (also in the surface brief)
THESIS: Every answer is a dated ledger entry, not a floating chat bubble. The surface refuses the centered messenger transcript and the anonymous card feed; time, evidence, and the current reading sit on the page as records.

OWN-WORLD: Warm buff ledger paper (`#ece3cf`) under a lighter sheet (`#f8f2e4`); ink (`#201b15`), oxblood (`#8a3030`), ledger blue (`#2e4f78`), stamp green (`#2f6a4c`). System sans carries prose; mono carries dates, times, source accessions, and state. Ruled 288px rail, 64px timestamp gutter, 2px radii, hairline rules, no pills or decorative gradients.

STORY: The visitor sees when each exchange happened, what Minimi currently believes, and which sources support it. They write a note, receive a dated answer, and can verify or revisit the claim instead of trusting a disposable bubble.

FIRST VIEWPORT: Ledger rail left (wordmark, new entry, grouped conversations, live clock, Auto/Light/Dark). Main topbar carries the date and timezone; request state is announced by the live region and shown by the disabled send control and answer skeleton. A 568px reading column sits on a 64px gutter; the 860px composer anchors the bottom with a date stamp and send control. The empty state leads with the day and three prompt slips.

FORM: Field Ledger. Chosen from the structured-question fallback; seed key `c78c7963`; first on the presented list.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Screenshots (captured, but the reviewing model here cannot accept image input)
- `.impeccable/review/desktop.png` — 1440×900, populated live conversation, light.
- `.impeccable/review/desktop-cite.png` — citation popover open.
- `.impeccable/review/desktop-empty.png` — fresh conversation, light.
- `.impeccable/review/desktop-dark.png` — populated, dark.
- `.impeccable/review/mobile.png` — 390×844 @2x, populated, light.
- `.impeccable/review/mobile-empty.png` — fresh, light.
- `.impeccable/review/mobile-dark.png` — populated, dark.
- `.impeccable/review/mobile-nav.png` — drawer open.

Capture validation: all files are non-zero (100–189 KB), dimensions are 1440×900 desktop and 780×1688 mobile @2x. Sampled pixels show the buff paper (`236,227,207`), light rail sheet (`248,242,228`), dark paper (`20,18,15`), dark rail (`27,24,19`) — no blank or black frames. No console/page errors during capture.

## Detector
`impeccable detect --json public/index.html` → `[]` after fixes.
Fixes applied from the first detector pass: all functional text at or above 11px; removed the repeating-gradient paper stripes; removed the pulsing status dot animations; shifted the page ground from pale cream `#f2ecdf` to deeper buff `#ece3cf` so the surface no longer reads as the default cream ground. `--faint` is `#6b6152` (light) / `#908573` (dark); `--muted` is `#5f5749` (light) / `#a99d8a` (dark).

## Layout and contrast evidence (Playwright, DOM measurement)
Desktop 1440×900, populated, light:
- No horizontal page overflow. Rail 288×900; main log 1152×762.6; topbar 41px.
- Composer 860×82.4 at x=434, bottom 886 (<900). Send 38×38.
- Turn body 568.2px wide, 15.5px. Two turns. Citation pill 11px.
- Source row: 34px accession column, 622.9px title, no overflow. Claim 450.4×28.7; meta 720×16.5; composer foot 11px, no overflow.
- Contrast: faint/paper 4.76; body/paper 13.39; cite 6.33; who 6.46; source meta 5.44; meta 4.76; as-of stamp 7.39; tagline 5.44; entry date 5.44.

Desktop dark: same layout. Contrast: faint/paper 5.15; body 14.8; cite 5.77; who 7.08; source meta 4.88; meta 5.15; as-of 6.70; tagline 4.88; entry date 4.88.

Mobile 390×844 @2x, populated, light:
- No horizontal overflow. Topbar 63px; composer 358×77 at bottom 830 (<844); send 42×42; menu 38×38.
- Body 348px wide with 15.5px; citation 24.9×19; source row 346px with 30px accession; claim 348×45.3; meta 348×16.5. Composer foot hidden as designed at ≤840.
- Contrast identical to desktop light.

Tablet 720×900: no horizontal overflow. Drawer rail off-canvas at x=-326.4; composer 676.8×59 at bottom 886; 11px functional text throughout; same contrasts.

Empty state: heading 54px desktop / 34px mobile; three prompt slips. No overflow.

## Behavior evidence
- Live chat completed in ~21.7s. During the request: send disabled, posting-line sweep, skeleton shimmer, status line, `aria-busy="true"` on the log. On done: busy cleared, rail refreshed, `aria-busy` removed, “Answer ready.” announced. The top-right status chip was removed in the final pass; no credit/usage UI remains. Then the `claims` event rendered one claim without locking the composer. No console/page errors.
- Shift+Enter inserts a newline; Enter sends. History loads; active rail entry is set; new conv clears to the empty state.
- Theme toggle switches and persists across reload. Dark contrast measured above.
- Mobile drawer opens via the menu button, moves focus to the close button, and closes on Escape with focus returned to the menu. The closed rail is `inert` on mobile so hidden controls are not tabbable. Focus moves to the composer on desktop first load.
- Citation buttons open a popover within the viewport on hover/focus; click opens the source in a new tab. Reduced-motion users get near-zero animation.
- `/api/conversations` drives the rail; `/api/history` returns claims and sources; the `claims` event arrives after `done` and the stream stays open for it.

## Polish pass verification — 2026-11-12
Final captures supersede the earlier shots: `.impeccable/review/final-desktop.png`, `final-desktop-cite.png`, `final-desktop-empty.png`, `final-desktop-dark.png`, `final-mobile.png`, `final-mobile-empty.png`, `final-mobile-nav.png`, `final-mobile-dark.png`, `final-mobile-320.png`, `final-tablet.png` (43–115 KB each, non-zero). These were measured after the last layout and behavior edits; the model still cannot accept image input.

Final measurements (Playwright, 1440×900 / 768×1024 / 390×844@2x / 320×568):
- Desktop: no horizontal overflow; rail 288×900; topbar 41px; composer 860×84.4 at x=434, bottom 886; send 40px (mouse); textarea 15px; body 568.2px. Empty date 720×52.9; slips 720×48. Theme color `#ece3cf` light / `#14120f` dark.
- Mobile 390: no overflow; topbar 69px; composer 358×65 at bottom 830; send/menu 44px; textarea 16px; body 358px; cite 26.9×24; source 356×108.5; claim 358×45.3; placeholder `Ask Minimi…`. Empty date 358×33.3; slip 358×61.7.
- Tablet 768: no overflow; drawer off-canvas; menu/send 44px; composer 736×65; textarea 16px; cite 26.9×24; body 568.2px.
- Small 320: no overflow; composer 288×65 at bottom 554; send/menu 44px; textarea 148×36, 16px; cite 26.9×24; source wraps to 286×156.5.
- Contrast (light/dark): body 13.39/14.80; cite 6.33/5.77; source meta 5.44/4.88; claim as-of 7.39/6.70; meta 4.76/5.15; placeholder 5.44/4.88. Minimum visible text contrast 4.76 light / 4.88 dark.
- Behavior: mobile drawer is `role="dialog"` with `main` inert, focus lands on `#railClose`, Escape closes; empty state has no turn; history 500 renders `.log-error` with retry, and retry loads 6 turns; mocked mobile streaming renders cite/source/claim/trace and clears busy; citation popover opens in viewport on focus.
- Detector rerun after final edits: `[]`.

## Post-review UI pass — 2026-11-12
- Removed the top-right status chip entirely; there is no credit, billing, or usage UI. Working/ready state remains in the `#live` region, the disabled send control, and the answer skeleton.
- Added composer recall: `ArrowUp` on an empty composer recalls the previous user message in the current conversation, repeated `ArrowUp` goes further back, `ArrowDown` moves forward and then clears. Arrow keys do not hijack a typed draft. Recall resets on New entry and conversation switch; New entry now also clears the composer.
- Composer hint is now `↑ recalls · Enter sends · Shift+Enter new line`.
- Playwright recall test on `0d096ee9-…` (3 user turns): up1 = last message, up2 = previous, down1 = last, down2 = empty; typed draft survived ArrowUp; New entry cleared the composer and recall. No console/page errors.
- Verified at 1440 light/dark and 390 mobile: no status chip, timezone still visible on mobile, no topbar or page overflow, contrast unchanged (minimum 4.76 light / 4.88 dark).
- Refreshed `desktop*.png`, `mobile*.png`, `final-mobile-320.png`, `final-tablet.png` after the change.
- Detector `[]`; extracted inline script passes `node --check`; `npm run typecheck` passes.

## Unified shell pass — 2026-11-12
- Split the self-contained page into `public/index.html`, `public/styles.css`, and `public/app.js`; theme bootstrap remains inline to prevent a flash of the wrong theme.
- Rebuilt the shell around the requested ledger layout: conversation rail with pinned and date groups, search, archive view, inline rename, pin/archive actions, delete confirmation with undo, header rename/actions, and a mobile drawer with focus containment and `inert` background.
- Added per-conversation drafts in `minimi-drafts`, rail keyboard navigation (`↑`/`↓`/`Home`/`End`, `Shift+F10`), settings tabs for appearance/chat/data, accent swatches, text size, density, content width, reduced motion, timestamp toggle, shortcuts overlay, JSON export, and reset/clear actions.
- Added live stop control via `AbortController`, retry, copy answer, copy code, source citations, claim as-of lists, working notes, date separators, jump-to-latest, offline banner, toasts, and stream-safe markdown with escaped code/source content.
- Added minimal persistence support: `PATCH /api/conversations/:id` for title/pin/archive, `DELETE /api/conversations/:id`, `DELETE /api/conversations`, and `DELETE /api/turns/:id`.
- Mocked Playwright flows passed: history render, search filter, dark/accent settings, header rename, new-chat empty state, mocked streaming with cite/source/claim/resolved/meta, archived view, delete undo, per-chat draft restoration, rail arrow focus, fresh-chat rename, mobile drawer, and no console/page errors.
- Actual-server smoke passed: no console/page errors, light theme CSS applied, no horizontal overflow, composer inside viewport, 200 from `/api/conversations` and `/api/history`; isolated `PATCH`/`DELETE` conversation routes returned `{ok:true}`.
- Refreshed `final-desktop.png`, `final-desktop-cite.png`, `final-desktop-empty.png`, `final-desktop-dark.png`, `final-mobile.png`, `final-mobile-empty.png`, `final-mobile-nav.png`, `final-mobile-dark.png`, `final-mobile-320.png`, and `final-tablet.png`.
- Captured metrics: 1440x900, 768x1024, 390x844, 320x568; no horizontal overflow at any size; composer bottom equals viewport bottom; log heights 739 / 867 / 693 / 417; populated history = 4 messages, empty = 0.
- `node --check public/app.js` and `npm run typecheck` pass.

## Known limitations / disclosure
- This session’s model cannot accept image input, so the screenshot files are passed as required evidence but were validated only by dimensions, file size, sampled pixels, and DOM metrics. The build thread also could not visually inspect the shots.
- The shipped `impeccable-finish-reviewer` agent is not exposed in this harness; this review is a substituted fresh-context pass using `reference/degraded/finish-reviewer.md`. Disclose this in the final report.
- The background assistant tests added conversations to the local store (`smoke2`, `smoke3`, `live-*`); they are not part of the shipped page.
- No production build step; the page is served as a static file by the existing `tsx watch` server on port 3000.

## Ask
Run the finish review from `C:\Users\guntu\.agents\skills\impeccable\reference\degraded\finish-reviewer.md` against this packet and the artifact. Return the five contract sections and exactly one disposition word: `ship`, `fix`, `rebuild`, or `recapture`. Use the direction contract above. Do not run the detector a second time. The screenshot paths are supplied; if your model cannot read images, say so and judge from the code, DOM metrics, detector result, and behavior evidence; do not invent visual observations.
