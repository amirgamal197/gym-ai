# Implementation Status

Source of requirements: `gym-guide-review.md` (Master Project Instructions).
Every phase is additive unless stated. Rollback copy of the previous phase: keep the `gym-guide-phase4.zip` you uploaded (it is not modified).

## Current state
- **Completed phases:** 1, 2, 3, 4 and 5 of 6
- **Last completed:** **Phase 5 — Professional UX and progress improvements** (project version `1.16.0`)
- **Next phase:** **Phase 6 — Testing and final release** (not started; waiting for your instruction)

## Project audit (from Phase 1, still accurate)

**Stack:** vanilla JavaScript ES modules, no bundler/build step, no package.json. Static site (Netlify config present), installable PWA (`service-worker.js`, `manifest.json`), Arabic-first RTL (`<html lang="ar" dir="rtl">`). State lives in `localStorage` (`gymGuide.state`, envelope `{version:1,data}`) behind `js/modules/storage.js`.

| File | Role |
|---|---|
| `js/app.js` | Entry point; one delegated click/keydown/input listener driven by `data-action` |
| `js/modules/exercises-data.js` | Exercise library: **155** exercises (104 original + 51 added in Phase 3), 12 muscle groups, stable string `id`s |
| `js/modules/data.js` | Workout days (`DATA.day1..3` Full Body, `DATA.dayPushA..dayLegsB` PPL) referencing library ids via `DayEx({id})` |
| `js/modules/schedule.js` | **(Phase 2)** Programs + weekly schedule state/logic (no DOM) |
| `js/modules/program.js` | Program hub UI: frequency, split, weekly schedule, day cards |
| `js/modules/workout.js` | Day pages, set toggling, logs, history, Gym Mode helpers |
| `js/modules/exercise-alternatives.js` | **(Phase 1, v2 in Phase 3)** Pure-logic alternatives engine; imported by the UI since Phase 4 |
| `js/modules/replacements.js` | **(Phase 4)** Pure-logic safe replacement: override map, archive/restore of sets+logs+history |
| `js/modules/alternatives-ui.js` | **(Phase 4)** Alternatives sheet (modal dialog), filters, explanations, confirm step |
| `js/modules/progress.js` | **(Phase 5)** Pure logic: exercise-id progress, weekly stats (Sat→Fri), PRs, calendar-aware `getTodayState` |
| `js/modules/progress-ui.js` | **(Phase 5)** HTML builders: line chart, weekly bars, PR list, per-exercise card (all with text alternatives) |
| `service-worker.js` | Precache list + `CACHE_NAME` (now `gym-guide-shell-v1.16.0`) |

**Constraints that still apply to later phases**
1. **Workout logs are keyed by position, not exercise id**: `STATE.sets["dayPushA-main-0"]`, `STATE.logs["dayPushA-main-0-<set>-w|r"]`, `STATE.history["dayPushA-main-0"]`. ~~Phase 4 must record the exercise id…~~ — **resolved in Phase 4**: the slot key always holds the *active* exercise's data; a swapped-out exercise's data lives under `<slotKey>~<exerciseId>`; every new history entry has `exerciseId`. Any new code that iterates `STATE.history` / `STATE.sets` keys must expect `~` archive keys (`isArchiveKey`, `parseArchiveKey` in `replacements.js`); code that reads a slot must go through `getSlotRef(dayKey, i)` (not `DATA[dayKey].main[i]`) to see replacements.
2. State keys are built as `"<dayKey>-main-<i>"` and parsed with `key.split("-")`, so **a day key must never contain a hyphen**, and it must start with `day` (workout hydration looks for `sec-day*`). `tools/validate-schedule.mjs` enforces both.
3. ~~`EQUIPMENT_TYPES` includes `"Band"` but no library exercise uses it~~ — resolved in Phase 3 (21 band exercises).

## Phase 5 — what was done

**Dashboard.** The hero is now a calendar-aware **Today** card (`getTodayState`): scheduled session (start, or *continue* when sets are ticked), *done today*, or *rest day* with the next scheduled session ("بكرة" / "يوم X"). On rest/done days a smaller link still offers the next session in the rotation, because people train off-schedule; the old stat card is renamed "الجاي بالترتيب". New below the week strip: **weekly volume bars** (last 8 weeks) and **latest personal records** (with a "new" badge), plus a link to the tracker. Weekly progress is a labelled `role="progressbar"`.

**Tracker.** New "التقدّم لكل تمرين" section above the existing per-day history (kept unchanged): one card per exercise with best 1RM, session count, volume change since the first session, a line chart (1RM) and a data table in a `<details>`. Curves follow `exerciseId`: slot history, `~` archive keys and the same lift on another program day merge into one curve; legacy entries resolve to the slot's original exercise; same key + same date counts once (latest wins). **Partial entries** count for PRs and weekly totals, not for the volume trend. History is still capped at 8 sessions per slot key (existing rule), so a curve is at most 8 points per slot it was done in.

**Bugs fixed.** (1) Session dates were UTC (`toISOString`): in Egypt a workout between 00:00 and ~03:00 was stamped with the previous day — now local (`localISODate` in `store.js`, used for sessions, Gym-Mode completion, partial swap entries and body metrics; existing saved dates are not rewritten). (2) Weekly counter started Monday while the schedule starts Saturday — now Saturday. (3) Tracker page could throw on an empty/corrupt history list.

**Accessibility / responsiveness.**
- Nav: plain landmark + `aria-current="page"` (the half-implemented tablist/tab/tabpanel roles were removed); each page has an accessible name and `document.title`; focus moves to the page content after user navigation (not on first load); smooth scroll respects `prefers-reduced-motion`; nav buttons ≥ 44px.
- Contrast: measured the tokens — all text colours are ≥ 5.4:1 on the surfaces, but **white text on the orange→amber gradient was 1.8–3.1:1** (nav active tab, CTA, Gym Mode buttons, filter chips, confirm button). Those surfaces now use `--energy-grad-solid` / `--energy-strong` (≥ 4.6:1). `--energy` / `--energy-2` remain for non-text accents.
- Charts: `role="img"` + numeric aria-label, real tables (visible in `<details>` for exercise curves, `.sr-only` for weekly bars), drawn `direction:ltr` so numbers never mirror; trend is also stated in words, not colour only.
- Found while testing: a `<section>` inside a page is `display:none` (global CSS `section{display:none}`), so new blocks use `div[role=group]`. A visually-hidden `<table>` itself overflowed at 320px; it is now wrapped in an `.sr-only` div.
- English exercise names in the Today card are wrapped `dir="ltr" lang="en"`.

**Files changed:** `js/modules/store.js` (`localISODate`), `workout.js`, `replacements.js`, `metrics.js` (local dates; tracker section + corrupt-list guard), `dashboard.js`, `navigation.js`, `css/styles.css`, `service-worker.js`, `README.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, tests `tools/e2e-phase2.py` (clock pinned to a Saturday for the dashboard check; cache version), `e2e-phase3.py`, `e2e-phase4.py`, `validate-replacements.mjs` (cache version only). **New:** `js/modules/progress.js`, `js/modules/progress-ui.js`, `tools/validate-progress.mjs`, `tools/e2e-phase5.py`.
**Not touched:** `data.js`, `exercises-data.js`, `exercise-alternatives.js`, `schedule.js`, `program.js`, `progression.js`, `timer.js`, `storage.js`, `profile.js`, `ui.js`, `exercises.js`, `alternatives-ui.js`.

## Verification actually run (Phase 5)
- `node --check` on every `.js`/`.mjs`: pass.
- `validate-alternatives` **2446/2446**, `validate-schedule` **356/356**, `validate-replacements` **67/67**, new `validate-progress` **37/37** (week boundaries, local-date helper, curves across swaps/days/archives, dedupe, partial entries, legacy entries, PRs, today states for Full Body and 6-day PPL, corrupt state never throws, HTML escaping, chart text alternatives).
- `e2e-phase2` **75/75**, `e2e-phase3` **20/20**, `e2e-phase4` **82/82**, new `e2e-phase5` **55/55** (headless Chromium): Today card in four states (train / rest / done / continue) with a pinned clock; progressbar; weekly bars and hidden table; PR badge; tracker curves and data table; partial-only and single-session cards; old history cards still present; nav semantics, focus, titles; reduced motion; **no horizontal overflow on 10 pages at 320/360/390/768/1100 px**; **Gym Mode on Push A end to end** (completion screen, history for all 6 exercises with `exerciseId` and local date, dashboard shows done and 1/6); no console errors, no failed HTTP.
- **Mutation check:** with `localISODate` temporarily reverted to the UTC date, the Cairo 00:30 test failed as intended; restored and re-ran green. (`validate-progress` cannot detect that regression by itself because the sandbox clock is UTC — the browser test sets `Africa/Cairo`.)
- I looked at 390 px dashboard and tracker screenshots.

## Not tested / known limitations
- **No real screen reader** (VoiceOver/TalkBack/NVDA), real device, iOS Safari or Firefox; accessibility is checked by DOM/ARIA assertions, measured contrast and keyboard-focus assertions only. Tab order was not audited by hand on every page.
- **Contrast** was computed for the design tokens and the orange surfaces only, not every combination in the 800-line stylesheet (e.g. text over the glass tiles, the Gym Mode timer colours).
- **Gym Mode** has no focus trap/`inert` background (the Phase 4 sheet does); it was exercised by clicks, not by keyboard.
- **Service worker offline/upgrade** still not exercised (static check only).
- **Curve length:** history keeps the last 8 sessions per slot (existing rule), so long-term progress beyond that is not available; there is no per-session detail view for deleted entries.
- **Estimated 1RM** uses the app's existing Epley formula on typed weights/reps; sessions without typed weights show volume/1RM 0 and are left out of charts but counted as trained days.
- **Today card** treats a session as done when any exercise of that day was saved/Gym-Mode-completed today; it does not require all six saved.
- Pull:push ≈ 1:1 in the PPL data is an observation, not changed (no program data was touched in Phase 5).
- Arabic/coaching text (including the new Phase 5 strings) is unreviewed by a native reader / fitness professional. Only Arabic RTL exists in this app; no English LTR UI.

## Phase 4 — what was done

**Alternatives button + sheet.** Every main-exercise card (day pages), the Gym Mode main phase and every Exercise Library card has **بدائل · Alternatives**. It opens a modal bottom sheet (`#altSheet`, `role="dialog" aria-modal`, focus moved in and restored on close, Tab trapped, background `inert`, Esc / backdrop / ✕ close; Esc inside Gym Mode closes only the sheet).

| Feature | Behaviour |
|---|---|
| Category filters | All / Machines / Barbells / Dumbbells / Cables / Bands / Bodyweight / Home, each with a result count; empty categories are hidden; `aria-pressed` |
| Equipment-aware default | "معداتي بس" switch ON by default when `STATE.profile.equipment` is set (hides what needs unowned gear, with a count of what is hidden); with no saved equipment a hint links to the profile instead |
| Close vs partial | Two sections with distinct badges ("بديل قريب" / "بديل جزئي") and a one-line meaning of each tier |
| Explanations | Per alternative: same/different target muscle and movement pattern (`muscleLabel`/`patternLabel`), plus chips for easier / harder / limited overload / same equipment / curated pin, and the `HOME_NOTES` line for household-item home exercises |
| No like-for-like swap | If an exercise has no close substitute, `PARTIAL_ONLY_REASONS` is shown (bilingual) instead of an unexplained list |
| Same-day duplicates | Exercises already in the same day are hidden (with a count), so a day can never hold the same exercise twice |
| Library cards | Browse-only mode (no replace buttons; says where to replace) |

**Safe replacement** (`replacements.js`, no DOM). `DATA` is never edited.
- `STATE.exerciseOverrides[dayKey][index] = { id, originalId, since }` and `STATE.swapLog` (last 100 swaps).
- `getSlotRef(dayKey, i)` = the effective exercise reference. A replacement keeps the slot's **sets × reps, rest and RPE target**, drops the original's tempo/cue/why/prog/reg (they describe a different movement) and shows the library's own instructions/mistake/tip instead.
- On swap: (1) today's ticked sets / typed weights on the outgoing exercise are written to its history as a `partial` entry (skipped if that slot was already saved today); (2) the outgoing exercise's sets, weights, reps, RPE and history are **moved** to `<slotKey>~<exerciseId>` (never deleted); (3) if the incoming exercise was used in this slot before, its archived data is moved back; (4) the override is set — or removed when the original is chosen.
- A confirm step lists exactly what is kept ("N completed sets … saved, not deleted", history stays linked, new exercise starts clean, same prescription, can be undone). Nothing is written before confirming.
- Refusals (same exercise, unknown id, already in the day, missing slot) change nothing and show a bilingual message.
- Saved-state hardening: non-object `exerciseOverrides`/`swapLog`/`sets`/`logs`/`history`, unknown ids and overrides equal to the original are ignored or repaired. The validator found one real crash of this kind while I was building it (a string in `exerciseOverrides`), which is fixed.
- Log keys are matched with an exact regex (`<key>-<n>-w|r`, `<key>-rpe`), so ids where one is a prefix of another (and `main-1` vs `main-10`) cannot mix data.

**Integration.** `workout.js` (completion counts, next exercise, Gym Mode completion, history entries get `exerciseId`), `timer.js` (button in Gym Mode, `refreshGymAfterReplace` restarts the swapped exercise at set 1 and leaves the rest of the session alone), `dashboard.js` ("next workout" hint), tracker (archived exercise listed with "تمرين اتبدّل — سجله محفوظ"; partial sessions labelled). Page re-render after a swap keeps the same random warm-up picks.

**Files changed:** `js/app.js`, `index.html`, `css/styles.css`, `service-worker.js` (`CACHE_NAME` → `v1.15.0`, three modules added to precache), `js/modules/workout.js`, `ui.js`, `timer.js`, `dashboard.js`, `exercises.js`, `icons.js` (`swap`, `x`), `README.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `tools/e2e-phase2.py` + `tools/e2e-phase3.py` (cache version / precache assertions only). **New:** `js/modules/replacements.js`, `js/modules/alternatives-ui.js`, `tools/validate-replacements.mjs`, `tools/e2e-phase4.py`.
**Not touched:** `data.js`, `exercises-data.js`, `exercise-alternatives.js`, `schedule.js`, `program.js`, `progression.js`, `storage.js`, `store.js`, `navigation.js`, `profile.js` — no exercise, day, program, schedule or engine data changed.

## Verification actually run (this phase)
- `node --check` on every `.js` / `.mjs`: pass.
- `node tools/validate-replacements.mjs`: **67/67** — untouched slots resolve to the `DATA` object itself; swap with work in progress (sets, weights, reps, RPE and history archived byte-for-byte, partial entry correct, neighbours and unrelated days untouched); restore brings everything back; swap-to-replacement-again restores its own data; A→B→C→B→A chain; all refusals leave state unchanged; corrupt saved overrides; id-prefix collision; **all 53 program slots round-trip losslessly (swap then restore)**; **every program slot still has a swap candidate for each of 7 equipment profiles after same-day duplicates are hidden**; `workout.js` integration (resolution, library coaching text, completion restart, Gym Mode completion records `exerciseId`); service-worker precache; sheet markup.
- `node tools/validate-alternatives.mjs` **2446/2446** and `node tools/validate-schedule.mjs` **356/356** (unchanged).
- `python3 tools/e2e-phase4.py` (headless Chromium, 390 px; one 1100 px check): **82/82** — button on all 6 cards and not on warm-up cards; modal semantics/inert/focus; equipment default and toggle; filters (cable, home); close/partial labelling and explanations on every item; same-day duplicates hidden; RTL close-button side; no overflow; confirm view contents and "nothing written before confirm"; Esc layering; replacement shows correct card, badge, empty sets/inputs, neighbour intact; state asserts (override, archived sets/logs/history, partial entry, legacy data byte-identical); reload persistence; new work stored under the slot; tracker lists both; restore returns 2 completed sets and weights; Tab/Shift+Tab trap, Esc and backdrop close, focus restore; Gym Mode (button, sheet above overlay, Esc closes only the sheet, replacement at set 1, page underneath consistent); dashboard/program render; library browse mode and the partial-only note (Chest Dip); no-profile case with hint link; desktop sizing; no console errors; no failed HTTP.
- `python3 tools/e2e-phase2.py` **75/75**, `python3 tools/e2e-phase3.py` **20/20** (only their cache-version / precache assertions were updated).
- **Mutation check:** I temporarily replaced the archive step with a deletion of the slot's sets; both `validate-replacements.mjs` and `e2e-phase4.py` failed, then I restored the code and re-ran everything green.
- I looked at 390 px and desktop screenshots of the list and confirm views.

## Not tested / known limitations
- **Real devices, iOS Safari, Firefox, screen readers** — only desktop Chromium emulating a phone. Focus handling and `inert` are standards-based but not verified with VoiceOver/TalkBack.
- **Service worker offline/upgrade** still not exercised (static check only: three modules precached, `CACHE_NAME` bumped). Existing installs pick up v1.15.0 after the next online load.
- **Replacement prescription is the slot's, not re-tuned.** A band or bodyweight swap for a 4×6-8 barbell lift keeps 4×6-8 and the same rest; the sheet warns that partial substitutes change stimulus, but it does not rewrite reps/rest/tempo. Progression suggestions for the replacement use that rep range and only its own logs.
- **Only main exercises are swappable.** Warm-up / mobility / activation / cool-down items are random picks, not tracked, and have no swap.
- **Swapping inside Gym Mode** updates the runner and the page underneath, but Gym Mode itself has never written per-set progress (it only marks the day at the end), so there are no in-session sets to archive there; ticked sets on the day page are archived as described.
- **Replacement is per day slot, not per program.** The same lift in another day (e.g. Back Squat in Full Body and Legs A) must be replaced there separately — intentional, since each day keeps its own history.
- **History cap:** each exercise/archive keeps the last 8 sessions (existing app rule). Archived exercises are never pruned automatically; there is no UI to delete one.
- **Coaching/Arabic content still unreviewed** by a fitness professional / native reader (alternatives tiers, explanation sentences, confirm-step wording, plus the Phase 2/3 content).
- Carried over from Phase 2 (Phase 5 candidates): pull:push ≈ 1:1 in PPL; "next workout" follows rotation not calendar; weekly counter starts Monday while the schedule UI starts Saturday; no dedicated "today" card; Gym Mode completion on PPL days not run end-to-end in a browser (only the data path is unit-tested).

## Phase 3 — what was done

**Library: 104 → 155 exercises** (`exercises-data.js`). 51 new entries appended after the originals (existing ids and order untouched), each with English + Arabic name, primary/secondary muscle, equipment, difficulty, 3 instructions, 2 mistakes, 2 tips. **No `illustration` link** on the new ones — links are only added once a direct exercise page has been verified, never guessed.

| Block | Count | Examples |
|---|---|---|
| Resistance band (`equipment: "Band"`) | 21 | `band-chest-press`, `band-lat-pulldown`, `band-seated-row`, `band-face-pull`, `band-pull-apart`, `band-triceps-pushdown`, `band-squat`, `band-pull-through`, `band-pallof-press`, `band-shrug` |
| Home (no equipment or a household item) | 17 | `pike-pushup`, `feet-elevated-pushup`, `bench-dip`, `doorframe-row`, `prone-y-raise`, `prone-lat-pulldown`, `isometric-towel-curl`, `bodyweight-squat`, `reverse-lunge`, `slider-hamstring-curl`, `bent-knee-calf-raise`, `side-lying-leg-raise`, `donkey-kick`, `crunch`, `bird-dog`, `backpack-shrug`, `bottle-lateral-raise` |
| Gym gap-fillers (give a like-for-like swap where none existed) | 13 | `incline-db-fly`, `decline-db-press`, `close-grip-db-press`, `dumbbell-skull-crusher`, `cable-rope-hammer-curl`, `dumbbell-reverse-curl`, `seated-dumbbell-calf-raise`, `captains-chair-leg-raise`, `machine-crunch`, `cable-woodchop`, `suitcase-carry`, `dumbbell-pullover` |

Resulting categories (an exercise can count under its equipment AND "home"): machine 21, barbell 26, dumbbell 33, cable 18, **band 21**, bodyweight 36, **home 37** (20 need nothing, 17 need a chair / towel / backpack / door — `HOME_NOTES` says which).

**Engine (`exercise-alternatives.js`, `ALT_DATA_VERSION = 2`)** — still pure logic (no DOM/STATE/storage), still not imported by the app.
- All 155 exercises tagged `[pattern, muscle, role]`. Matching is muscle-specific (upper / mid / lower chest, gastrocnemius vs soleus, lats vs mid-back, rear vs side delts, …) — a flat bench never gets an incline or decline press as "close".
- Tiers: **close** = same pattern AND same muscle; **partial** = shares the muscle or the movement family, or has a low overload ceiling. Bodyweight/household moves and band *compounds* are flagged `limited-overload` and capped at partial for a heavy lift; band *isolation* work (curls, pushdowns, raises) can be close.
- Practical difficulty (`easier`/`harder`), equipment availability from the profile (`availableCategoriesFromProfile`), and category tabs including `home` and `band` are all supported in `getAlternatives(id, opts)`.
- New: `getHomeAlternatives` (split into `none` / `adaptable` + note), `getBestAlternative`, `getPartialOnlyReason`, `getCategoryCounts`, `muscleLabel` / `patternLabel`, and bilingual `MUSCLE_LABELS`, `PATTERN_LABELS`, `HOME_NOTES`, `PARTIAL_ONLY_REASONS`.
- `ALT_OVERRIDES` now used where rules mislead (curated, symmetric, commented): `leg-press ↔ hack-squat` pinned close; `bicycle-crunch ↔ crunch / machine-crunch / cable-crunch` pinned partial.
- Rule changes vs Phase 1: `bicycle-crunch` retagged `rotation/obliques` (was `crunch/abs`); stability work (plank ↔ ab wheel ↔ dead bug) no longer downgraded by the limited-overload rule; `crunch`/`rotation` are no longer one family (a woodchop is not a leg-raise substitute).
- **Partial-only gaps:** 28 exercises had no close substitute in Phase 1; now **6** (`chest-dip`, `dips`, `upright-row`, `zottman-curl`, `dead-hang`, `side-plank`). Each has a bilingual written reason in `PARTIAL_ONLY_REASONS`, and the validator fails if an exercise has no close substitute and no reason.
- Relationships (directed): 436 close, 1162 partial.

**Coverage guarantee (validator-enforced):** each of the 38 exercises used in the Full Body and PPL programs has at least one substitute for someone who owns *only* bands, *only* bodyweight, *only* dumbbells, *only* cables, or *only* machines, and at least one home substitute. (The first coverage run found 5 holes — dumbbell shrug, lateral raise and the two vertical pulls for several equipment profiles — which is why `band-shrug`, `backpack-shrug`, `bottle-lateral-raise`, `dumbbell-pullover` and `prone-lat-pulldown` exist.)

**Files changed:** `js/modules/exercises-data.js`, `js/modules/exercise-alternatives.js`, `service-worker.js` (`CACHE_NAME` → `gym-guide-shell-v1.14.0`), `README.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, `tools/validate-alternatives.mjs`, `tools/e2e-phase2.py` (cache-version assertion only); new `tools/e2e-phase3.py`. **Not touched:** `data.js`, `schedule.js`, `workout.js`, `program.js`, `dashboard.js`, `progression.js`, `app.js`, `css/styles.css`, `storage.js` and every other module — no workout day, set, log or history logic changed.

## Phase 3 — verification (kept for reference)
`validate-alternatives.mjs` 2446/2446, `validate-schedule.mjs` 356/356, `e2e-phase2.py` 75/75, `e2e-phase3.py` 20/20 at the end of Phase 3. Phase 3 caveats still apply: unreviewed Arabic, no illustration links on the 51 new exercises, coarse home classification (`none` vs `adaptable`), unreviewed coaching tiers.

## Phase 2 — what was done (unchanged, kept for reference)

**Three selectable programs** (all share the same exercise library, warm-up/mobility/activation/cool-down, Gym Mode, set tracking, logs, history, progression):

| Program id | Days/week | Sessions |
|---|---|---|
| `fullbody` (**default**, original) | 3 | `day1`, `day2`, `day3` — unchanged |
| `ppl3` | 3 | `dayPushA`, `dayPullA`, `dayLegsA` |
| `ppl6` | 6 | `dayPushA`, `dayPullA`, `dayLegsA`, `dayPushB`, `dayPullB`, `dayLegsB` |

**PPL routines** (`data.js`, 6 exercises each, all library ids, full prescription: sets/reps, tempo, rest, RPE, cue, mistake, why, progression, regression). A = heavy compound-led; B = different main lift/emphasis.
- Push A (chest): barbell bench, incline DB press, seated DB press, lateral raise, overhead cable triceps ext., pushdown — 18 sets
- Pull A (width + thickness): pull-ups, chest-supported row, 1-arm DB row, face pull, EZ curl, hammer curl — 18 sets
- Legs A (squat): back squat, RDL, walking lunge, seated leg curl, standing calf raise, hanging leg raise — 20 sets
- Push B (shoulders): overhead press, machine chest press, cable fly, cable lateral raise, overhead DB ext., diamond push-up — 19 sets
- Pull B (row + rear delts): bent-over row, lat pulldown, seated cable row, reverse pec deck, incline DB curl, DB shrug — 19 sets
- Legs B (hinge + single-leg): hip thrust, Bulgarian split squat, lying leg curl, leg extension, seated calf raise, Pallof press — 19 sets
- Each day has a `split` tag (`push|pull|legs`); Push/Pull use `upper` warm-up content, Legs use `lower`.

**Flexible weekly schedule** (`schedule.js`, persisted in `STATE.schedule`):
```
STATE.schedule = { programId, lastThree, trainingDays: { "3": [weekday…], "6": [weekday…] } }
```
weekday = `Date.getDay()` (0=Sun…6=Sat). Week is shown Saturday-first. Defaults: 3-day = Sat/Mon/Wed; 6-day = Sat→Thu, Fri rest. Training days are configurable per frequency (each remembers its own). Sessions are handed to the chosen days in week order. Adding a day to a full plan is refused with an explanation; removing leaves a visible "N/M" incomplete state rather than silently auto-filling. Full Body on adjacent days shows an advisory (never blocks). Absent/corrupt saved state falls back to the original Full Body program and default days.

**UI**
- Program page: frequency chips (3 and 6 enabled; 2/4/5 remain honest "Soon"), split picker (3 days: Full Body vs PPL; 6 days: single program description), tappable Sat→Fri schedule grid with per-day session label or "راحة", reset-to-default, day cards with Push/Pull/Legs badges. Keyboard focus returns to the control after each re-render.
- Dashboard: Sat→Fri week strip (training links, rest days muted, today highlighted, "عدّل" link) and weekly target = active program's days (3 or 6). "Next workout" rotates over the active program's days.
- Tracker: shows the day label under each exercise (the same lift can exist in several days, each with its own history).
- Progression: deload cycle = 6 weeks × days/week (18 sessions for 3-day — same as before — 36 for 6-day).

**History safety:** schedule/program changes only write `STATE.schedule` and the legacy `STATE.programDaysPerWeek` (kept in sync). They never read-modify `sets`, `logs` or `history`; PPL days use their own keys, so legacy `day1-main-*` data is untouched and still shown.

**Files changed:** `js/modules/schedule.js` (new), `js/modules/data.js`, `js/modules/program.js` (rewritten), `js/modules/workout.js`, `js/modules/dashboard.js`, `js/modules/progression.js`, `js/app.js`, `css/styles.css`, `service-worker.js`, `README.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`; new `tools/validate-schedule.mjs`, `tools/e2e-phase2.py`.
**Breaking internal change:** `DAY_KEYS` is no longer exported from `workout.js` (replaced by `ALL_DAY_KEYS` / `getActiveDayKeys()` in `schedule.js`). No other file in the project imports it any more.

## Remaining phases
- **Phase 6 — Testing/final release:** run every validator and e2e suite again from a clean unzip, fix regressions, manual keyboard/screen-reader pass if possible, service-worker offline/upgrade check, final README/CHANGELOG, final ZIP.

## Exact next step
Start **Phase 6** only when you say so. Things Phase 6 should know:
1. Test tools: `node tools/validate-{alternatives,schedule,replacements,progress}.mjs`, `python3 tools/e2e-phase{2,3,4,5}.py` (Playwright; `E2E_SHOTS=<dir>` saves screenshots on 4 and 5). `e2e-phase2`/`5` use `page.clock.set_system_time` (Playwright ≥ 1.45).
2. Open candidates: service-worker offline/upgrade test, Gym Mode keyboard/focus trap, full contrast sweep, a Firefox/WebKit run of the e2e suites.
3. Read workout slots through `getSlotRef` / `resolveDayMain`; history keys can be `"<slotKey>"` or `"<slotKey>~<exerciseId>"`; use `localISODate` (never `toISOString`) for calendar dates; don't put a `<section>` inside a page.
